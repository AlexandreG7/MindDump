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
export async function exchangeMobileAuthCode(code: unknown, verifier: unknown) {
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

  // Même contenu que le jeton posé par NextAuth (callbacks jwt de src/lib/auth.ts).
  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
      role: user.role,
      consented: !!user.consentedAt,
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
