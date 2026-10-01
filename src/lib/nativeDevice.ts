import { isNativeApp, nativePlatform } from "./native";

/**
 * Jeton de l'extension de partage iOS (docs/app-mobile.md, étape 3.4).
 *
 * L'extension « Partager → MindDump » n'a pas les cookies de l'app : une fois
 * connectée, l'app demande un jeton lié à cet appareil
 * (/api/mobile-auth/device) et le range dans le trousseau partagé avec
 * l'extension (plugin natif ShareAuth). Renouvelé à chaque lancement de l'app,
 * effacé à la déconnexion ; révoquer l'appareil depuis le profil le rend
 * inutilisable.
 */

type ShareAuthPlugin = {
  set(options: { token: string; server: string }): Promise<void>;
  clear(): Promise<void>;
};

function shareAuth(): ShareAuthPlugin | undefined {
  const plugins = (window as Window & { Capacitor?: { Plugins?: { ShareAuth?: ShareAuthPlugin } } }).Capacitor
    ?.Plugins;
  return plugins?.ShareAuth;
}

const SYNCED_KEY = "minddump-share-token-synced";

/** À appeler une fois la session établie ; sans effet hors de l'app iOS. */
export async function syncShareToken() {
  const plugin = shareAuth();
  if (!isNativeApp() || nativePlatform() !== "ios" || !plugin) return;
  try {
    if (sessionStorage.getItem(SYNCED_KEY)) return;
  } catch {}

  const res = await fetch("/api/mobile-auth/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device: { platform: "ios" } }),
  }).catch(() => null);
  if (!res?.ok) return;
  const { shareToken } = (await res.json()) as { shareToken: string };
  await plugin.set({ token: shareToken, server: window.location.origin });
  try {
    sessionStorage.setItem(SYNCED_KEY, "1");
  } catch {}
}

/** Déconnexion : l'extension ne doit plus pouvoir agir au nom du compte. */
export async function clearShareToken() {
  await shareAuth()?.clear().catch(() => {});
  try {
    sessionStorage.removeItem(SYNCED_KEY);
  } catch {}
}
