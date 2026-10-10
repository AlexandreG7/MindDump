/**
 * Identifiant du build, figé dans le code au build (next.config.mjs). Le client
 * le compare à celui du serveur (/api/version) : s'ils diffèrent, un nouveau
 * déploiement a eu lieu et la page ouverte (HTML et JS périmés) doit se recharger.
 */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
