/**
 * Le serveur envoie lui-même une requête à l'endpoint d'un abonnement push :
 * on n'accepte que ceux des services push des navigateurs, pour qu'un client
 * ne puisse pas lui faire appeler une adresse de son choix (SSRF).
 */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge (Android), navigateurs Chromium
  "push.apple.com", // Safari, PWA iOS (web.push.apple.com)
  "push.services.mozilla.com", // Firefox
  "notify.windows.com", // Edge (Windows)
];

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port) return false;
  return PUSH_SERVICE_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
  );
}
