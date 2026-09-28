/**
 * Détection de l'app native (coque Capacitor, docs/app-mobile.md phase 3).
 *
 * L'app charge minddump.fr dans sa WebView et y injecte `window.Capacitor` :
 * pas besoin d'embarquer @capacitor/core dans le site pour le savoir.
 */
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** Marqueur ajouté à l'agent utilisateur par l'app (mobile/capacitor.config.ts). */
export const NATIVE_USER_AGENT_MARKER = "MindDumpApp/";

/** Côté serveur : la requête vient-elle de l'app native ? */
export function isNativeUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent?.includes(NATIVE_USER_AGENT_MARKER);
}

/** Vrai dans l'app iOS / Android, faux dans un navigateur (y compris la PWA). */
export function isNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

/** "ios", "android" ou "web". */
export function nativePlatform(): string {
  return capacitor()?.getPlatform?.() ?? "web";
}
