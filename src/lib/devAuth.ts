/**
 * Détermine si le bypass d'authentification de développement (SKIP_AUTH) est actif.
 *
 * SÉCURITÉ : ce bypass ne doit JAMAIS pouvoir s'activer en production, même si une
 * variable d'environnement erronée (ex. .env copié depuis le dev) définit SKIP_AUTH=true.
 * On exige donc explicitement NODE_ENV !== "production".
 */
export const isAuthBypassEnabled =
  process.env.SKIP_AUTH === "true" && process.env.NODE_ENV !== "production";

// Une variable SKIP_AUTH en production n'a aucun effet (voir ci-dessus), mais sa
// présence trahit une configuration copiée depuis le dev : on le signale au démarrage.
if (process.env.NODE_ENV === "production" && (process.env.SKIP_AUTH || process.env.NEXT_PUBLIC_SKIP_AUTH)) {
  console.warn("[auth] SKIP_AUTH est défini en production : il est ignoré, retire-le de la configuration.");
}
