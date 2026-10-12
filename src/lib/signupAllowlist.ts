import { parseEmail } from "./email";

/**
 * Contournement manuel des inscriptions fermées (MindDump est en bêta privée).
 *
 * `ALLOWED_SIGNUP_EMAILS` (variable d'exécution, lue à chaque appel : jamais
 * figée au build) : adresses d'administrateurs ou de proches qui peuvent créer
 * un compte sans invitation. Tolérant : guillemets en bordure retirés, séparateurs
 * virgule, point-virgule, espace ou retour à la ligne. Une entrée qui n'est pas une
 * adresse ASCII valide est ignorée (un seul avertissement par valeur de la variable,
 * sans écrire les adresses). Absente ou sans entrée valide = aucune adresse.
 *
 * L'invitation (src/lib/signupInvite.ts) est l'autre voie : la création d'un compte
 * est autorisée si l'adresse est dans cette liste OU si une invitation valide la vise.
 *
 * Ne concerne QUE la création d'un nouvel utilisateur. Un compte existant se
 * connecte et lie un fournisseur comme avant (ADR 0001 : rien ne disparaît pour
 * son auteur).
 */

export const SIGNUP_CLOSED_MESSAGE = "Les inscriptions sont fermées pour le moment.";

const QUOTES = /^["'`“”‘’]+|["'`“”‘’]+$/g;

let warnedFor: string | null = null;

/** Adresses valides, normalisées, d'une valeur brute de la variable. */
export function parseAllowlist(raw: string): { emails: Set<string>; ignored: number } {
  const emails = new Set<string>();
  let ignored = 0;
  const unquoted = raw.trim().replace(QUOTES, "");
  for (const part of unquoted.split(/[,;\s]+/)) {
    const entry = part.replace(QUOTES, "");
    if (!entry) continue;
    const email = parseEmail(entry);
    if (email) emails.add(email);
    else ignored++;
  }
  return { emails, ignored };
}

/** Adresses autorisées, normalisées. Vide si la variable est absente ou sans entrée valide. */
export function allowedSignupEmails(): Set<string> {
  const raw = process.env.ALLOWED_SIGNUP_EMAILS ?? "";
  const { emails, ignored } = parseAllowlist(raw);
  if (ignored > 0 && warnedFor !== raw) {
    warnedFor = raw;
    // Jamais les adresses : seulement leur nombre.
    console.warn(
      `[signup] ALLOWED_SIGNUP_EMAILS : ${ignored} entrée(s) ignorée(s) car pas une adresse e-mail valide (ASCII). Vérifie la variable.`
    );
  }
  return emails;
}

/** Cette adresse est-elle dans la liste blanche (création d'un NOUVEAU compte) ? */
export function isSignupAllowed(email: unknown): boolean {
  const wanted = parseEmail(email);
  return !!wanted && allowedSignupEmails().has(wanted);
}
