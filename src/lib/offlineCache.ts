/**
 * Caches du service worker (src/app/sw.ts) qui contiennent des données d'un
 * compte : pages déjà vues, photos, réponses d'API gardées pour le hors ligne. Le précache (code de l'app, page hors
 * ligne) est commun à tous et n'en fait pas partie.
 */
export const OFFLINE_CACHES = {
  pages: "pages",
  // Ancien cache des charges RSC (remplacé par warmPage dans sw.ts) : encore
  // effacé à la déconnexion sur les appareils qui l'ont.
  rsc: "pages-rsc",
  images: "images",
  api: "api",
} as const;

/**
 * En `next dev`, aucun service worker n'est construit (next.config.mjs), mais
 * celui d'un build de production lancé sur le même port (localhost:3000…) reste
 * installé et intercepte les requêtes du serveur de dev, avec des réponses
 * périmées ou en erreur. Script inline du layout, en dev seulement : le
 * désinscrire et vider ses caches.
 */
export const devServiceWorkerCleanupScript = `(function(){if(!("serviceWorker" in navigator))return;navigator.serviceWorker.getRegistrations().then(function(rs){if(!rs.length)return;Promise.all(rs.map(function(r){return r.unregister()})).then(function(){return self.caches?caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}):null}).then(function(){console.info("[dev] service worker de production désinscrit");location.reload()})}).catch(function(){})})();`;

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
