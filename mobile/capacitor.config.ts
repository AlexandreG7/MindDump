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
  // Fond avant le chargement de la page : défini côté natif, clair ou sombre
  // selon le téléphone (MainViewController, MainActivity).
  plugins: {
    // Bouton retour Android géré par MainActivity.
    App: { disableBackButtonHandler: true },
    // Le site déclare viewport-fit=cover : sans cette indication, Android
    // décale d'abord la WebView des barres système puis la remet plein écran
    // une fois la page affichée (saut de 15 dp du logo d'ouverture).
    SystemBars: { initialViewportFitValueHint: "cover" },
  },
  ios: {
    // WKAppBoundDomains (Info.plist) : nécessaire pour le service worker.
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
