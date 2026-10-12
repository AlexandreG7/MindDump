import { prisma } from "./prisma";
import { useSecureCookies } from "./secureCookies";

/**
 * Invitation de foyer (`GroupInvite`, lien /groups/join/<jeton>) qui ouvre AUSSI le droit de
 * créer un compte, puis ramène au groupe.
 *
 * Règle (décision « option A ») : SEUL un lien NOMINATIF (`GroupInvite.email` renseigné) permet
 * de s'inscrire, et seulement pour cette adresse (normalisée). Un lien ouvert (sans adresse)
 * sert uniquement à rejoindre le foyer quand on a déjà un compte : il ne donne aucun droit
 * d'inscription. Un lien qui fuite ne peut donc pas ouvrir la bêta à un inconnu : c'est
 * l'invitant qui fixe l'adresse.
 * - le lien doit être valide : jeton connu, non expiré, pas encore utilisé pour rejoindre ;
 * - jeton de 32 caractères (`isSignupGroupInviteToken`) : les anciens cuid ne servent qu'à
 *   rejoindre, jamais à s'inscrire ;
 * - UNE seule inscription par lien : `signupClaimedAt` est posé par un `updateMany` conditionnel
 *   DANS la transaction de création du compte (createUserWithGrant) ;
 * - le jeton n'est PAS consommé pour s'inscrire : la personne revient sur la page du groupe et
 *   rejoint par le flux existant (même rôle « member », mêmes règles de visibilité).
 * Risque résiduel (B4, docs/oauth.md) : l'adresse n'est pas prouvée par un e-mail de
 * vérification ; elle est choisie par l'invitant, qui est un membre connu du foyer.
 * Les mêmes limites de débit que l'inscription par mot de passe s'appliquent
 * (/api/auth/register, /api/signup-invite, GET /api/groups/join/[token]).
 */

export const GROUP_INVITE_INVALID_MESSAGE =
  "Ce lien d'invitation de groupe ne permet pas de créer un compte (expiré, déjà utilisé, déjà associé à une inscription, ou sans adresse e-mail associée). Demande à la personne qui t'invite un lien à ton adresse.";

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

/** Jetons de foyer pour REJOINDRE : cuid historique (25 caractères) ou 32 caractères aléatoires base64url. */
export const isGroupInviteToken = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(value);

/** Jetons de foyer pour S'INSCRIRE : uniquement les 32 caractères aléatoires (`randomBytes(24)`), pas les anciens cuid. */
export const isSignupGroupInviteToken = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);

/**
 * Ce lien de foyer peut-il encore servir à créer un compte ? Existe, jeton de 32 caractères,
 * NOMINATIF, non expiré, ni utilisé, ni déjà associé à une inscription. `email` : adresse imposée.
 */
export async function findSignupGroupInvite(token: unknown) {
  if (!isSignupGroupInviteToken(token)) return null;
  const invite = await prisma.groupInvite.findFirst({
    where: { token, usedAt: null, signupClaimedAt: null, expiresAt: { gt: new Date() }, email: { not: null } },
    select: { email: true, group: { select: { name: true } } },
  });
  const email = invite?.email?.trim().toLowerCase();
  return invite && email ? { email, groupName: invite.group.name } : null;
}

/** Une adresse peut-elle s'inscrire avec ce lien nominatif ? Seulement la sienne. */
export const groupInviteAcceptsEmail = (inviteEmail: string, email: string | null) =>
  !!email && inviteEmail === email;
