import { nativePlatform } from "./native";

/**
 * Connexion Google / Apple depuis l'app native (docs/app-mobile.md, étape 3.2 ;
 * serveur : src/lib/mobileAuth.ts, docs/oauth.md).
 *
 * La page de connexion s'ouvre dans le navigateur système — ASWebAuthenticationSession
 * sur iOS (plugin WebAuth de l'app), Custom Tabs sur Android (@capacitor/browser)
 * — qui revient vers `minddump://auth?code=…`. Le code est échangé, avec le
 * verifier PKCE gardé ici, contre une session posée dans la WebView.
 *
 * Les plugins sont appelés par `window.Capacitor.Plugins`, injecté par l'app :
 * le site n'embarque pas les paquets Capacitor.
 */

const CALLBACK_SCHEME = "minddump";
const CALLBACK_PREFIX = `${CALLBACK_SCHEME}://auth`;

type Listener = { remove: () => Promise<void> };
// Appelé par window.Capacitor.Plugins, addListener rend l'objet d'écoute
// lui-même ; par les paquets Capacitor, une promesse. On accepte les deux.
type ListenerResult = Listener | Promise<Listener>;
type NativePlugins = {
  WebAuth?: { start(options: { url: string; callbackScheme: string }): Promise<{ url: string }> };
  Browser?: {
    open(options: { url: string }): Promise<void>;
    close(): Promise<void>;
    addListener(event: "browserFinished", callback: () => void): ListenerResult;
  };
  App?: {
    addListener(event: "appUrlOpen", callback: (data: { url: string }) => void): ListenerResult;
  };
};

export class SignInCanceled extends Error {}

function plugins(): NativePlugins {
  return (window as Window & { Capacitor?: { Plugins?: NativePlugins } }).Capacitor?.Plugins ?? {};
}

const base64Url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function pkcePair() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

/** Ouvre la page dans le navigateur système et attend le retour minddump://auth. */
async function openAuthSession(url: string): Promise<string> {
  const { WebAuth, Browser, App } = plugins();

  if (nativePlatform() === "ios" && WebAuth) {
    try {
      return (await WebAuth.start({ url, callbackScheme: CALLBACK_SCHEME })).url;
    } catch (error) {
      if ((error as { code?: string }).code === "CANCELED") throw new SignInCanceled();
      throw error;
    }
  }

  if (!Browser || !App) throw new Error("Connexion indisponible dans cette version de l'app");

  // Android : Custom Tabs, retour par l'intent minddump://auth (AndroidManifest).
  return new Promise<string>((resolve, reject) => {
    const listeners: ListenerResult[] = [];
    let done = false;
    const finish = (callback: () => void) => {
      if (done) return;
      done = true;
      listeners.forEach((l) =>
        Promise.resolve(l)
          .then((listener) => listener.remove())
          .catch(() => {})
      );
      callback();
    };
    listeners.push(
      App.addListener("appUrlOpen", ({ url: opened }) => {
        if (!opened.startsWith(CALLBACK_PREFIX)) return;
        Browser.close().catch(() => {});
        finish(() => resolve(opened));
      })
    );
    // Onglet fermé sans revenir par minddump:// : l'utilisateur a abandonné.
    // (Laissé un instant à appUrlOpen, qui peut arriver juste après.)
    listeners.push(
      Browser.addListener("browserFinished", () => {
        setTimeout(() => finish(() => reject(new SignInCanceled())), 1000);
      })
    );
    Browser.open({ url }).catch((error) => finish(() => reject(error)));
  });
}

/**
 * Connexion complète : renvoie l'URL où aller ensuite. Lève SignInCanceled si
 * l'utilisateur ferme la fenêtre, une Error pour tout autre échec.
 */
export async function nativeSignIn(provider: string, callbackUrl = "/"): Promise<string> {
  const { verifier, challenge } = await pkcePair();
  const start = new URL("/api/mobile-auth/start", window.location.origin);
  start.searchParams.set("provider", provider);
  start.searchParams.set("challenge", challenge);

  const callback = new URL(await openAuthSession(start.href));
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("La connexion n'a pas abouti");

  const res = await fetch("/api/mobile-auth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, verifier, device: { platform: nativePlatform() } }),
  });
  if (!res.ok) throw new Error("La connexion a expiré, réessaie");

  // Seulement un chemin du site (jamais « //autre-site »).
  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
}
