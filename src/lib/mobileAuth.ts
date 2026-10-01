import { createHash, randomBytes } from "crypto";
import { encode } from "next-auth/jwt";
import { prisma } from "./prisma";
import { useSecureCookies } from "./secureCookies";

/**
 * Connexion depuis l'app mobile (docs/app-mobile.md, étape 2.1).
 *
 * Google refuse l'OAuth dans une WebView embarquée : l'app ouvre le navigateur
 * système (ASWebAuthenticationSession, Custom Tabs), qui se connecte comme sur
 * le web puis renvoie vers l'app un code à usage unique. L'app l'échange contre
 * une session posée dans sa WebView. Comme en PKCE, le code ne vaut rien sans le
 * `verifier` que seule l'app connaît : une autre app qui intercepterait le lien
 * minddump:// ne pourrait pas s'en servir.
 *
 *   app ── /api/mobile-auth/start?provider&challenge ──▶ navigateur système
 *        connexion NextAuth ──▶ /api/mobile-auth/complete ──▶ minddump://auth?code
 *   app (WebView) ── POST /api/mobile-auth/exchange {code, verifier} ──▶ cookie de session
 */

export const MOBILE_REDIRECT = "minddump://auth";

// lastSeenAt n'est rafraîchi qu'une fois par heure, pas à chaque requête.
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Un jeton émis pour l'app porte l'id de son appareil : tant que l'appareil
 * existe (révoquer le supprime), la session reste valable (callback jwt de
 * src/lib/auth.ts). Une requête indexée par clé primaire, pour les seules
 * sessions de l'app.
 */
export async function isMobileDeviceActive(deviceId: string): Promise<boolean> {
  const device = await prisma.mobileDevice.findUnique({
    where: { id: deviceId },
    select: { lastSeenAt: true },
  });
  if (!device) return false;
  if (Date.now() - device.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await prisma.mobileDevice
      .update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }
  return true;
}

const CODE_TTL_MS = 60 * 1000;
const PURGE_AFTER_MS = 10 * 60 * 1000;
// Même durée que la session NextAuth par défaut (30 jours).
const SESSION_MAX_AGE_S = 30 * 24 * 3600;

/** Cookie posé dans le navigateur système le temps de la connexion OAuth. */
export const CHALLENGE_COOKIE = {
  name: `${useSecureCookies ? "__Secure-" : ""}minddump.mobile-auth`,
  options: {
    httpOnly: true,
    // Apple revient en POST cross-site (form_post) : Lax ne suffirait pas.
    sameSite: useSecureCookies ? ("none" as const) : ("lax" as const),
    secure: useSecureCookies,
    path: "/",
    maxAge: 15 * 60,
  },
};

const SESSION_COOKIE = `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`;

const sha256 = (value: string) => createHash("sha256").update(value).digest("base64url");

/** Défi PKCE S256 : SHA-256 du verifier en base64url (43 caractères). */
export const isChallenge = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

/** Verifier PKCE (RFC 7636) : 43 à 128 caractères non réservés. */
const isVerifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._~-]{43,128}$/.test(value);

export async function createMobileAuthCode(
  userId: string,
  challenge: string,
  provider: string | null
): Promise<string> {
  await prisma.mobileAuthCode.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - PURGE_AFTER_MS) } },
  });
  const code = randomBytes(32).toString("base64url");
  await prisma.mobileAuthCode.create({
    data: {
      codeHash: sha256(code),
      challenge,
      userId,
      provider,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * Vérifie et consomme le code. Toute tentative le brûle, même ratée : un code
 * intercepté ne laisse qu'un essai. Renvoie le cookie de session à poser, ou null.
 */
const PLATFORMS = new Set(["ios", "android"]);

/** Nom lisible de l'appareil, envoyé par l'app (ex. « iPhone de Camille »). */
function deviceInfo(device: unknown) {
  const d = (device ?? {}) as { name?: unknown; platform?: unknown };
  const platform = typeof d.platform === "string" && PLATFORMS.has(d.platform) ? d.platform : "unknown";
  const name =
    typeof d.name === "string" && d.name.trim()
      ? d.name.trim().slice(0, 80)
      : platform === "ios"
        ? "iPhone ou iPad"
        : platform === "android"
          ? "Appareil Android"
          : "Appareil mobile";
  return { name, platform };
}

export async function exchangeMobileAuthCode(code: unknown, verifier: unknown, device?: unknown) {
  if (typeof code !== "string" || !isVerifier(verifier)) return null;

  const record = await prisma.mobileAuthCode.findUnique({ where: { codeHash: sha256(code) } });
  if (!record) return null;

  const claimed = await prisma.mobileAuthCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  if (record.expiresAt < new Date() || sha256(verifier) !== record.challenge) return null;

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true, name: true, email: true, image: true, role: true, consentedAt: true },
  });
  if (!user) return null;

  // Chaque connexion depuis l'app est un appareil, révocable depuis le profil.
  const mobileDevice = await prisma.mobileDevice.create({
    data: { userId: user.id, ...deviceInfo(device) },
  });
  return sessionCookieFor(user, mobileDevice.id);
}

type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  consentedAt: Date | null;
};

/** Cookie de session NextAuth d'un appareil de l'app (même jeton que NextAuth). */
async function sessionCookieFor(user: SessionUser, deviceId: string) {
  // Même contenu que le jeton posé par NextAuth (callbacks jwt de src/lib/auth.ts).
  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
      role: user.role,
      consented: !!user.consentedAt,
      deviceId,
    },
    secret: process.env.NEXTAUTH_SECRET as string,
    maxAge: SESSION_MAX_AGE_S,
  });

  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: useSecureCookies,
      path: "/",
      maxAge: SESSION_MAX_AGE_S,
    },
  };
}

// ─── Jeton de partage (extension de partage iOS, étape 3.4) ────────
//
// L'extension de partage n'a pas accès aux cookies de l'app : elle s'authentifie
// par `Authorization: Bearer mdt_…` (src/lib/session.ts). Le jeton appartient à
// un appareil : il meurt quand l'appareil est révoqué ou se déconnecte.

export const SHARE_TOKEN_PREFIX = "mdt_";

/**
 * Appareil de la session en cours, créé s'il n'existe pas (connexion par mot
 * de passe dans l'app, qui ne passe pas par l'échange de code), et nouveau
 * jeton de partage. Renvoie aussi le cookie de session à reposer quand
 * l'appareil vient d'être créé, pour que la déconnexion le supprime.
 */
export async function ensureDeviceWithShareToken(
  userId: string,
  currentDeviceId: string | null,
  device: unknown
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, role: true, consentedAt: true },
  });
  if (!user) return null;

  let deviceId = currentDeviceId;
  if (deviceId && !(await prisma.mobileDevice.findFirst({ where: { id: deviceId, userId } }))) {
    deviceId = null;
  }
  const created = !deviceId;
  if (!deviceId) {
    deviceId = (await prisma.mobileDevice.create({ data: { userId, ...deviceInfo(device) } })).id;
  }

  const shareToken = SHARE_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  await prisma.mobileDevice.update({
    where: { id: deviceId },
    data: { shareTokenHash: sha256(shareToken) },
  });

  return {
    shareToken,
    cookie: created ? await sessionCookieFor(user, deviceId) : null,
  };
}

/** Utilisateur d'un jeton de partage valide, ou null. */
export async function shareTokenUser(token: string) {
  if (!token.startsWith(SHARE_TOKEN_PREFIX)) return null;
  const device = await prisma.mobileDevice.findUnique({
    where: { shareTokenHash: sha256(token) },
    select: {
      id: true,
      lastSeenAt: true,
      userId: true,
    },
  });
  if (!device) return null;
  if (Date.now() - device.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await prisma.mobileDevice
      .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }
  return prisma.user.findUnique({
    where: { id: device.userId },
    select: { id: true, name: true, email: true, image: true },
  });
}
