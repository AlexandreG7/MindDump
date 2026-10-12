import { prisma } from "./prisma";
import { useSecureCookies } from "./secureCookies";

/**
 * Invitation de foyer (`GroupInvite`, lien /groups/join/<jeton>) qui ouvre AUSSI le droit de
 * créer un compte, puis ramène au groupe.
 *
 * Modèle existant : un lien vaut 7 jours et sert une fois à REJOINDRE le groupe (`usedAt`,
 * posé par POST /api/groups/join/[token]). Il peut être nominatif (`email`) ou ouvert
 * (`email` vide). Règle d'inscription, la plus prudente pour un lien qui peut fuiter :
 * - le lien doit être valide : jeton connu, non expiré, pas encore utilisé pour rejoindre ;
 * - UNE seule inscription par lien : `signupClaimedAt` est posé par un `updateMany`
 *   conditionnel DANS la transaction de création du compte (createUserWithGrant). Un lien
 *   ouvert qui fuite ne crée donc qu'un compte, pas un accès à la bêta pour tout le monde ;
 * - lien nominatif : seule son adresse peut s'inscrire (comparaison sans casse) ;
 * - le jeton n'est PAS consommé pour rejoindre : la personne revient sur la page du groupe
 *   et rejoint par le flux existant (même rôle « member », mêmes règles de visibilité).
 * Les mêmes limites de débit que l'inscription par mot de passe s'appliquent
 * (/api/auth/register, /api/signup-invite, GET /api/groups/join/[token]).
 */

export const GROUP_INVITE_INVALID_MESSAGE =
  "Ce lien d'invitation de groupe n'est plus valable (expiré, déjà utilisé ou déjà associé à une inscription).";

/** Cookie posé juste avant Google/Apple depuis /register?groupInvite= (voir /api/signup-invite). */
export const GROUP_INVITE_COOKIE = {
  name: `${useSecureCookies ? "__Secure-" : ""}minddump.signup-group-invite`,
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
export const clearGroupInviteCookieHeader = `${GROUP_INVITE_COOKIE.name}=; Path=${GROUP_INVITE_COOKIE.options.path}; Max-Age=0; HttpOnly${
  useSecureCookies ? "; Secure; SameSite=None" : "; SameSite=Lax"
}`;

/** Jetons de foyer : cuid historique (25 caractères) ou 32 caractères aléatoires base64url. */
export const isGroupInviteToken = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(value);

/** Chemin de la page du groupe, où l'on revient après l'inscription (jeton validé par sa forme). */
export function groupJoinPath(token: string): string {
  return `/groups/join/${token}`;
}

/** Ce lien de foyer peut-il encore servir à créer un compte ? (existe, non expiré, ni utilisé, ni déjà associé à une inscription). */
export async function findSignupGroupInvite(token: unknown) {
  if (!isGroupInviteToken(token)) return null;
  const invite = await prisma.groupInvite.findFirst({
    where: { token, usedAt: null, signupClaimedAt: null, expiresAt: { gt: new Date() } },
    select: { email: true, group: { select: { name: true } } },
  });
  return invite ? { email: invite.email?.trim().toLowerCase() || null, groupName: invite.group.name } : null;
}

/** Une adresse peut-elle s'inscrire avec ce lien ? Lien ouvert : toute adresse. Nominatif : la sienne. */
export const groupInviteAcceptsEmail = (inviteEmail: string | null, email: string | null) =>
  !!email && (inviteEmail === null || inviteEmail === email);
