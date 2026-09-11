/**
 * Détermine si le bypass d'authentification de développement (SKIP_AUTH) est actif.
 *
 * SÉCURITÉ : ce bypass ne doit JAMAIS pouvoir s'activer en production, même si une
 * variable d'environnement erronée (ex. .env copié depuis le dev) définit SKIP_AUTH=true.
 * On exige donc explicitement NODE_ENV !== "production".
 */
export const isAuthBypassEnabled =
  process.env.SKIP_AUTH === "true" && process.env.NODE_ENV !== "production";
