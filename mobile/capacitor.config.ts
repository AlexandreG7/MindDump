import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Coque native de MindDump (docs/app-mobile.md, phase 3).
 *
 * L'app charge le site en ligne : une mise à jour déployée sur Coolify arrive
 * dans l'app sans nouvelle version sur les stores. `www/` ne contient qu'un
 * écran de repli si le site est injoignable au premier lancement.
 *
 * MINDDUMP_URL permet de pointer vers un serveur local pendant le
 * développement (ex. http://localhost:3110 sur le simulateur iOS).
 */
const serverUrl = process.env.MINDDUMP_URL ?? "https://minddump.fr";
const host = new URL(serverUrl).host;

const config: CapacitorConfig = {
  appId: "fr.minddump.app",
  appName: "MindDump",
  webDir: "www",
  // Permet au serveur de reconnaître l'app (src/lib/native.ts), dès la
  // première requête, avant tout JavaScript.
  appendUserAgent: "MindDumpApp/1",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    // Seul MindDump s'ouvre dans l'app ; tout autre lien part dans le
    // navigateur système.
    allowNavigation: [host],
    errorPath: "offline.html",
  },
  ios: {
    // Fond derrière la barre d'état tant que la page n'a pas chargé.
    backgroundColor: "#F8F7F5",
    // WKAppBoundDomains (Info.plist) : nécessaire pour le service worker.
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    backgroundColor: "#F8F7F5",
  },
};

export default config;
