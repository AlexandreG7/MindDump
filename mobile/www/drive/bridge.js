// Pont entre le script de l'extension Match (drive-extension/content.js) et
// l'app (docs/app-mobile.md, étape 3.6). Injecté par l'écran Match natif
// (MatchDrivePlugin) dans une seconde WebView, après page.js.
//
// content.js parle à chrome.runtime ; ici, un équivalent minimal le relie au
// natif :
// - sendMessage({ type: "api" }) : appel à MindDump, relayé par la page
//   MindDump de l'app (session de l'utilisateur, liste blanche dans
//   src/lib/matchDrive.ts) ;
// - sendMessage({ type: "takeFill" }) : liste en attente, gardée côté natif ;
// - onMessage « fill » : relance depuis le bouton « Remplir le panier ».
window.__minddumpDrive = function (run) {
  if (window.__minddumpDriveStarted) return;
  window.__minddumpDriveStarted = true;

  const toNative = (message) => {
    const body = JSON.stringify(message);
    if (window.webkit?.messageHandlers?.minddumpDrive) window.webkit.messageHandlers.minddumpDrive.postMessage(body);
    else if (window.MindDumpDrive) window.MindDumpDrive.postMessage(body);
  };

  const sender = { id: "minddump-app" };
  const pending = new Map();
  const listeners = [];
  let seq = 0;

  window.__minddumpNative = {
    reply(id, result) {
      const resolve = pending.get(id);
      pending.delete(id);
      resolve?.(result);
    },
    fill(listId) {
      for (const listener of listeners) listener({ type: "fill", listId }, sender, () => {});
    },
  };

  const chrome = {
    runtime: {
      id: sender.id,
      sendMessage(message) {
        return new Promise((resolve) => {
          const id = ++seq;
          pending.set(id, resolve);
          toNative({ id, message });
        });
      },
      onMessage: {
        addListener(listener) {
          listeners.push(listener);
        },
      },
    },
  };

  // Comme l'extension (document_idle), mais en attendant que l'app Nuxt du
  // site soit montée : page.js en a besoin pour lire le magasin et le panier.
  const nuxtReady = () => !!document.querySelector("#__nuxt")?.__vue_app__;
  (function wait(attempt) {
    if (nuxtReady() || attempt > 60) run(chrome);
    else setTimeout(() => wait(attempt + 1), 250);
  })(0);
};
