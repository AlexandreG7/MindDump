// Service worker : seul endroit qui parle à MindDump. Le script du site Match
// ne peut pas appeler minddump.fr directement (CORS) ; il passe par ici.

const DEFAULT_BASE_URL = "https://minddump.fr";

async function settings() {
  const { baseUrl, apiKey } = await chrome.storage.local.get(["baseUrl", "apiKey"]);
  return { baseUrl: (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""), apiKey: apiKey || "" };
}

// Seules ces routes sont appelables depuis le site Match ou la popup.
const ALLOWED = [
  /^GET \/api\/lists$/,
  /^GET \/api\/drive\/match\/plan\?listId=[\w-]+$/,
  /^POST \/api\/drive\/match\/rank$/,
  /^PUT \/api\/drive\/match\/products$/,
];

async function callApi({ method, path, body }) {
  if (!ALLOWED.some((re) => re.test(`${method} ${path}`))) {
    return { ok: false, status: 400, error: "Appel non autorisé" };
  }
  const { baseUrl, apiKey } = await settings();
  if (!apiKey) return { ok: false, status: 401, error: "Clé API MindDump manquante : ouvre l'extension pour la renseigner." };
  try {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error = res.status === 401 ? "Clé API MindDump refusée." : data?.error || `Erreur ${res.status}`;
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, error: "MindDump est injoignable." };
  }
}

// ------------------------------------------------------------ lancement
// La popup se ferme dès qu'un onglet s'ouvre ou prend le focus : c'est donc ici
// qu'on ouvre la page Match et qu'on lui transmet la liste à traiter.
// Onglet ouvert ou rechargé par nous : la liste attend dans storage.session et
// le script du site la réclame à son chargement (« takeFill »). Si le script
// était chargé avant, on la lui envoie directement une fois la page prête.

const MATCH_URL = "https://www.supermarchesmatch.fr/*";
const MATCH_HOME = "https://www.supermarchesmatch.fr/fr";

async function setPending(tabId, listId) {
  await chrome.storage.session.set({ [`fill:${tabId}`]: listId });
}

async function takePending(tabId) {
  const key = `fill:${tabId}`;
  const { [key]: listId } = await chrome.storage.session.get(key);
  if (listId) await chrome.storage.session.remove(key);
  return listId || null;
}

async function deliverWhenLoaded(tabId) {
  await new Promise((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(onUpdated); clearTimeout(timer); resolve(); };
    const onUpdated = (id, info) => { if (id === tabId && info.status === "complete") done(); };
    const timer = setTimeout(done, 30000);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((t) => t.status === "complete" && done()).catch(done);
  });
  for (let attempt = 0; attempt < 10; attempt++) {
    const listId = await takePending(tabId);
    if (!listId) return; // déjà réclamée par le script du site
    try {
      await chrome.tabs.sendMessage(tabId, { type: "fill", listId });
      return;
    } catch {
      await setPending(tabId, listId);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function startFill(listId) {
  const [current] = await chrome.tabs.query({ active: true, currentWindow: true, url: MATCH_URL });
  const tab = current || (await chrome.tabs.query({ url: MATCH_URL }))[0];
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "fill", listId });
      return;
    } catch {
      // Onglet ouvert avant l'installation de l'extension : sans script, on recharge.
      await setPending(tab.id, listId);
      await chrome.tabs.reload(tab.id);
      return deliverWhenLoaded(tab.id);
    }
  }
  const created = await chrome.tabs.create({ url: MATCH_HOME });
  await setPending(created.id, listId);
  return deliverWhenLoaded(created.id);
}

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`fill:${tabId}`));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Messages de la popup ou de nos propres scripts de contenu uniquement.
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === "api") {
    callApi(message).then(sendResponse);
    return true;
  }
  if (message?.type === "startFill" && typeof message.listId === "string") {
    sendResponse({ ok: true });
    startFill(message.listId).catch(() => {});
    return false;
  }
  if (message?.type === "takeFill" && sender.tab?.id != null) {
    takePending(sender.tab.id).then((listId) => sendResponse({ listId }));
    return true;
  }
  return false;
});
