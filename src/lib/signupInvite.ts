import { createHash, randomBytes } from "crypto";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "./prisma";
import { useSecureCookies } from "./secureCookies";
import { isSignupAllowed } from "./signupAllowlist";
import { parseEmail } from "./email";
import { isGroupInviteToken } from "./groupInviteSignup";

/**
 * Liens d'inscription à usage unique (bêta privée).
 *
 * Même mécanique que passwordReset.ts : jeton de 32 octets aléatoires (base64url),
 * seule l'empreinte SHA-256 est stockée, le jeton en clair ne vit que dans le lien
 * que l'administrateur transmet lui-même. Un lien vise UNE adresse, vaut 14 jours
 * et sert une fois. En générer un nouveau pour la même adresse invalide les
 * précédents.
 *
 * Règle de création d'un compte (mot de passe ET Google/Apple) : l'adresse est dans
 * la table AllowedSignupEmail (signupAllowlist.ts, gérée dans /admin) OU une invitation valide la vise.
 * Fermé par défaut. Le jeton est consommé DANS la transaction qui crée l'utilisateur
 * (`createUserWithGrant`) : deux inscriptions simultanées avec le même lien, un seul compte.
 */

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const INVITE_INVALID_MESSAGE =
  "Ce lien d'invitation n'est plus valable (expiré, déjà utilisé ou remplacé).";
export const INVITE_EMAIL_MISMATCH_MESSAGE = "Utilise l'adresse à laquelle tu as été invité.";
/** Page de connexion avec ce message (OAuthButtons.tsx : oauthErrorMessage). */
export const INVITE_EMAIL_MISMATCH_URL = "/login?error=InviteEmailMismatch";

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/** Cookie posé juste avant Google/Apple depuis /register?invite= (voir /api/signup-invite). */
export const INVITE_COOKIE = {
  name: `${useSecureCookies ? "__Secure-" : ""}minddump.signup-invite`,
  options: {
    httpOnly: true,
    // Apple revient en POST cross-site (form_post) : Lax ne suffirait pas (authProviders.ts).
    sameSite: useSecureCookies ? ("none" as const) : ("lax" as const),
    secure: useSecureCookies,
    // Lu par la route NextAuth seulement.
    path: "/api/auth",
    maxAge: 15 * 60,
  },
};
export const clearInviteCookieHeader = `${INVITE_COOKIE.name}=; Path=${INVITE_COOKIE.options.path}; Max-Age=0; HttpOnly${
  useSecureCookies ? "; Secure; SameSite=None" : "; SameSite=Lax"
}`;

export function inviteLink(token: string): string {
  const base = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://minddump.fr").replace(/\/+$/, "");
  return `${base}/register?invite=${token}`;
}

const isToken = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

/** Invitation encore utilisable pour ce jeton (existe, ni utilisée, ni remplacée, ni expirée). */
export async function findValidInvite(token: unknown) {
  if (!isToken(token)) return null;
  return prisma.signupInvite.findFirst({
    where: { tokenHash: digest(token), usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, requestId: true },
  });
}

/**
 * Crée une invitation pour cette adresse (normalisée) et invalide les précédentes
 * encore ouvertes. Marque la demande d'accès correspondante comme « invitée ».
 * Renvoie le jeton EN CLAIR : à montrer une fois, jamais relisible ensuite.
 */
export async function issueInvite(opts: { email: string; createdById: string; requestId?: string | null }) {
  const email = parseEmail(opts.email);
  if (!email) throw new Error("Adresse invalide");
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.signupInvite.updateMany({
      where: { email, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const request = opts.requestId
      ? await tx.betaAccessRequest.findUnique({ where: { id: opts.requestId }, select: { id: true } })
      : await tx.betaAccessRequest.findUnique({ where: { email }, select: { id: true } });
    await tx.signupInvite.create({
      data: {
        tokenHash: digest(token),
        email,
        expiresAt,
        createdById: opts.createdById,
        requestId: request?.id ?? null,
      },
    });
    if (request) {
      await tx.betaAccessRequest.updateMany({
        // Une demande déjà « inscrite » le reste.
        where: { id: request.id, status: { not: "registered" } },
        data: { status: "invited", decidedAt: now, updatedAt: now },
      });
    }
  });
  return { token, expiresAt, link: inviteLink(token) };
}

export type CreateUserResult =
  | { ok: true; user: User }
  | { ok: false; reason: "closed" | "exists" };

/**
 * Seul chemin de création d'un utilisateur (inscription par mot de passe et
 * adaptateur NextAuth). Dans UNE transaction :
 * 1. verrou sur l'adresse (deux créations simultanées de la même adresse, quelle que
 *    soit la casse, s'enchaînent au lieu de se doubler : pas d'index unique sur
 *    lower(email), voir docs/migrations-prisma.md) ;
 * 2. refus si un compte porte déjà cette adresse, sans tenir compte de la casse ;
 * 3. adresse autorisée (table `AllowedSignupEmail`, relue ICI sous le verrou : un retrait de
 *    l'administrateur est tranché proprement) ; sinon consommation de l'invitation par un `updateMany` conditionnel :
 *    0 ligne = jeton absent, utilisé, expiré, remplacé ou pour une autre adresse. À défaut
 *    d'invitation bêta, une invitation de FOYER (`groupInviteToken`, groupInviteSignup.ts) est
 *    « réclamée » de la même façon (une seule inscription par lien, adresse conforme si le lien
 *    est nominatif) sans être consommée pour rejoindre le groupe ;
 * 4. création de l'utilisateur (adresse stockée en minuscules) ;
 * 5. la demande d'accès correspondante passe à « inscrite ».
 */
export async function createUserWithGrant(
  email: string,
  data: Omit<Prisma.UserCreateInput, "email">,
  inviteToken?: unknown,
  groupInviteToken?: unknown
): Promise<CreateUserResult> {
  const normalized = parseEmail(email);
  if (!normalized) return { ok: false, reason: "closed" };
  // Pré-contrôle avant le verrou : sans jeton ni adresse autorisée, « fermé » AVANT toute lecture
  // de comptes (un compte existant ne se distingue pas d'une adresse inconnue). Refait plus bas
  // sous le verrou pour l'adresse autorisée.
  if (!isToken(inviteToken) && !isGroupInviteToken(groupInviteToken) && !(await isSignupAllowed(normalized))) {
    return { ok: false, reason: "closed" };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${normalized}))`;

    const existing = await tx.user.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return { ok: false as const, reason: "exists" as const };

    // Relue sous le verrou : un retrait simultané de l'adresse ne laisse pas passer la création.
    let granted = await isSignupAllowed(normalized, tx);
    if (isToken(inviteToken)) {
      const now = new Date();
      const consumed = await tx.signupInvite.updateMany({
        where: {
          tokenHash: digest(inviteToken),
          email: normalized,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count === 1) granted = true;
    }
    if (!granted && isGroupInviteToken(groupInviteToken)) {
      const now = new Date();
      const claimed = await tx.groupInvite.updateMany({
        where: {
          token: groupInviteToken,
          usedAt: null,
          signupClaimedAt: null,
          expiresAt: { gt: now },
          // Lien ouvert (sans adresse) ou nominatif pour cette adresse, sans tenir compte de la casse.
          OR: [{ email: null }, { email: { equals: normalized, mode: "insensitive" } }],
        },
        data: { signupClaimedAt: now },
      });
      if (claimed.count === 1) granted = true;
    }
    if (!granted) return { ok: false as const, reason: "closed" as const };

    const user = await tx.user.create({ data: { ...data, email: normalized } });
    const now = new Date();
    await tx.betaAccessRequest.updateMany({
      where: { email: normalized },
      data: { status: "registered", decidedAt: now, updatedAt: now },
    });
    return { ok: true as const, user };
  });
}
