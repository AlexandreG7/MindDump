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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Messages de la popup ou de nos propres scripts de contenu uniquement.
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === "api") {
    callApi(message).then(sendResponse);
    return true;
  }
  return false;
});
