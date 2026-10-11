import { prisma } from "./prisma";

/**
 * Adresses e-mail : une seule normalisation pour tout le projet.
 *
 * - `normalizeEmail` : trim, NFKC, minuscules. C'est la forme stockée pour les
 *   NOUVEAUX comptes, les demandes d'accès et les invitations.
 * - `parseEmail` : accepte uniquement une adresse ASCII stricte. Le contrôle porte
 *   sur la saisie AVANT normalisation : NFKC replierait le signe Kelvin (U+212A) sur
 *   « K », ce qui ferait passer « ᴋ » pour « k » et permettrait de contourner la
 *   liste blanche ou de doubler un compte. Hors ASCII : refusé, jamais « corrigé ».
 *
 * Les comptes antérieurs peuvent avoir une casse mixte (« Alice@… ») : on ne les
 * réécrit pas (ADR 0001), on les retrouve sans tenir compte de la casse.
 */

export function normalizeEmail(raw: string): string {
  return raw.trim().normalize("NFKC").toLowerCase();
}

// Local : lettres, chiffres et . _ % + - ; domaine : labels ASCII, extension de 2 lettres au moins.
const STRICT_EMAIL = /^(?!.*\.\.)[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

/** Adresse normalisée si la saisie est une adresse ASCII valide, sinon null. */
export function parseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length > 254 || !STRICT_EMAIL.test(trimmed)) return null;
  return normalizeEmail(trimmed);
}

/**
 * Compte portant cette adresse : correspondance exacte d'abord, puis sans tenir
 * compte de la casse si elle est unique. Deux comptes qui ne diffèrent que par la
 * casse et aucune correspondance exacte : ambigu, personne (on ne devine pas).
 */
export async function findUserByEmail(raw: string) {
  const email = raw.trim();
  if (!email) return null;
  const select = { id: true, email: true, name: true, image: true, role: true, password: true } as const;
  const exact = await prisma.user.findUnique({ where: { email }, select });
  if (exact) return exact;
  const similar = await prisma.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select,
    take: 2,
  });
  return similar.length === 1 ? similar[0] : null;
}
