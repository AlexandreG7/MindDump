/**
 * Abonnement de l'appareil courant aux notifications push (côté navigateur).
 * Le service worker (src/app/sw.ts) affiche les notifications reçues.
 */

export type PushSupport =
  | "supported"
  | "unsupported" // navigateur sans Web Push
  | "ios-install"; // iPhone / iPad : seulement une fois l'app sur l'écran d'accueil

export function pushSupport(): PushSupport {
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return "supported";
}

async function registration() {
  // Le service worker n'existe pas en `next dev` (next.config.mjs).
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error("Service worker absent");
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Demande l'autorisation, abonne l'appareil et l'enregistre côté serveur. */
export async function subscribeToPush(publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission");

  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    }));

  const res = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) throw new Error("server");
}

/**
 * Retire l'abonnement de cet appareil, côté serveur puis navigateur. Appelé
 * aussi à la déconnexion : un appareil partagé ne doit plus recevoir les
 * rappels du compte qui l'a quitté.
 */
export async function unsubscribeFromPush() {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}
