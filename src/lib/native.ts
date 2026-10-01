/**
 * Détection de l'app native (coque Capacitor, docs/app-mobile.md phase 3).
 *
 * L'app charge minddump.fr dans sa WebView et y injecte `window.Capacitor` :
 * pas besoin d'embarquer @capacitor/core dans le site pour le savoir.
 */
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    SystemBars?: { setStyle(options: { style: "DARK" | "LIGHT" }): Promise<void> };
    Haptics?: { impact(options: { style: "LIGHT" | "MEDIUM" | "HEAVY" }): Promise<void> };
  };
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** Marqueur ajouté à l'agent utilisateur par l'app (mobile/capacitor.config.ts). */
export const NATIVE_USER_AGENT_MARKER = "MindDumpApp/";

/**
 * Cookie posé par l'app (nativeAppCookieScript) : les requêtes du service
 * worker, qui ne portent pas l'agent utilisateur modifié de la WebView, le
 * transmettent, elles.
 */
export const NATIVE_APP_COOKIE = "minddump-app";

/** Côté serveur : la requête vient-elle de l'app native ? */
export function isNativeRequest(
  userAgent: string | null | undefined,
  cookie: string | undefined
): boolean {
  return !!userAgent?.includes(NATIVE_USER_AGENT_MARKER) || cookie === "1";
}

/** Script inline du layout : dans l'app, pose le cookie NATIVE_APP_COOKIE. */
export const nativeAppCookieScript = `(function(){try{if(navigator.userAgent.indexOf("${NATIVE_USER_AGENT_MARKER}")!==-1&&document.cookie.indexOf("${NATIVE_APP_COOKIE}=1")===-1){document.cookie="${NATIVE_APP_COOKIE}=1; path=/; max-age=31536000; samesite=lax"}}catch(e){}})();`;

/** Vrai dans l'app iOS / Android, faux dans un navigateur (y compris la PWA). */
export function isNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

/** "ios", "android" ou "web". */
export function nativePlatform(): string {
  return capacitor()?.getPlatform?.() ?? "web";
}

/**
 * Icônes de la barre d'état assorties au thème affiché, y compris quand
 * l'utilisateur force un thème différent de celui du téléphone (ThemeContext).
 */
export function setNativeSystemBars(dark: boolean) {
  if (!isNativeApp()) return;
  capacitor()
    ?.Plugins?.SystemBars?.setStyle({ style: dark ? "DARK" : "LIGHT" })
    .catch(() => {});
}

/** Petit retour haptique dans l'app (cocher une tâche, un article). */
export function nativeHaptic() {
  if (!isNativeApp()) return;
  capacitor()
    ?.Plugins?.Haptics?.impact({ style: "LIGHT" })
    .catch(() => {});
}
