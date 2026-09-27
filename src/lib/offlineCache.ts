/**
 * Caches du service worker (src/app/sw.ts) qui contiennent des données d'un
 * compte : pages déjà vues, photos, réponses d'API gardées pour le hors ligne. Le précache (code de l'app, page hors
 * ligne) est commun à tous et n'en fait pas partie.
 */
export const OFFLINE_CACHES = {
  pages: "pages",
  rsc: "pages-rsc",
  images: "images",
  api: "api",
} as const;

/**
 * RGPD : rien d'un compte ne doit rester sur un appareil partagé après la
 * déconnexion ou la suppression du compte.
 */
export async function clearOfflineCaches() {
  if (typeof caches === "undefined") return;
  try {
    await Promise.all(Object.values(OFFLINE_CACHES).map((name) => caches.delete(name)));
  } catch {
    // Cache Storage indisponible (navigation privée…) : rien à effacer.
  }
}
