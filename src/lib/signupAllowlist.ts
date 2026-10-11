/**
 * Inscriptions fermées (MindDump est privé jusqu'à la V1).
 *
 * `ALLOWED_SIGNUP_EMAILS` (variable d'exécution, lue à chaque appel : jamais
 * figée au build) : adresses séparées par des virgules, comparées sans tenir
 * compte de la casse ni des espaces. Variable absente ou vide = fermé : aucune
 * nouvelle inscription.
 *
 * Ne concerne QUE la création d'un nouvel utilisateur. Un compte existant se
 * connecte et lie un fournisseur comme avant, qu'il soit dans la liste ou non
 * (ADR 0001 : rien ne disparaît pour son auteur).
 */

export const SIGNUP_CLOSED_MESSAGE = "Les inscriptions sont fermées pour le moment.";

const normalize = (email: string) => email.trim().toLowerCase();

/** Adresses autorisées, normalisées. Vide si la variable est absente ou vide. */
export function allowedSignupEmails(): Set<string> {
  const raw = process.env.ALLOWED_SIGNUP_EMAILS ?? "";
  return new Set(raw.split(",").map(normalize).filter(Boolean));
}

/** Y a-t-il au moins une adresse autorisée ? Sinon les inscriptions sont fermées pour tous. */
export function isSignupOpen(): boolean {
  return allowedSignupEmails().size > 0;
}

/** Cette adresse peut-elle créer un NOUVEAU compte ? */
export function isSignupAllowed(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const wanted = normalize(email);
  return !!wanted && allowedSignupEmails().has(wanted);
}
