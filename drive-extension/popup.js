const DEFAULT_BASE_URL = "https://minddump.fr";
const $ = (id) => document.getElementById(id);

function show(section) {
  $("fill").hidden = section !== "fill";
  $("settings").hidden = section !== "settings";
}

async function loadLists() {
  $("fill-msg").textContent = "";
  const res = await chrome.runtime.sendMessage({ type: "api", method: "GET", path: "/api/lists" });
  if (!res.ok) {
    $("fill-msg").textContent = res.error;
    $("go").disabled = true;
    return;
  }
  const lists = res.data.filter((l) => l.type === "GROCERY");
  const { lastListId } = await chrome.storage.local.get("lastListId");
  $("list").replaceChildren(
    ...lists.map((l) => {
      const left = l.items.filter((i) => !i.checked).length;
      const option = new Option(`${l.name} (${left} article${left > 1 ? "s" : ""})`, l.id);
      option.selected = l.id === lastListId;
      return option;
    })
  );
  $("go").disabled = !lists.length;
  if (!lists.length) $("fill-msg").textContent = "Aucune liste de courses dans MindDump.";
}

$("go").addEventListener("click", async () => {
  const listId = $("list").value;
  if (!listId) return;
  await chrome.storage.local.set({ lastListId: listId });
  // Le service worker ouvre la page Match et lui transmet la liste : la popup,
  // elle, se ferme dès qu'un onglet prend le focus.
  await chrome.runtime.sendMessage({ type: "startFill", listId });
  window.close();
});

$("edit").addEventListener("click", async () => {
  const { baseUrl, apiKey } = await chrome.storage.local.get(["baseUrl", "apiKey"]);
  $("url").value = baseUrl || DEFAULT_BASE_URL;
  $("key").value = apiKey || "";
  show("settings");
});

$("save").addEventListener("click", async () => {
  const apiKey = $("key").value.trim();
  let baseUrl;
  try {
    const url = new URL($("url").value.trim() || DEFAULT_BASE_URL);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error();
    baseUrl = url.origin;
  } catch {
    $("settings-msg").textContent = "Adresse invalide (https obligatoire, sauf localhost).";
    return;
  }
  if (!apiKey.startsWith("mdk_")) {
    $("settings-msg").textContent = "Une clé API MindDump commence par « mdk_ ».";
    return;
  }
  // Une autre adresse que minddump.fr (serveur de test) demande une autorisation.
  if (baseUrl !== DEFAULT_BASE_URL) {
    const granted = await chrome.permissions.request({ origins: [`${baseUrl}/*`] });
    if (!granted) {
      $("settings-msg").textContent = "Autorisation refusée pour cette adresse.";
      return;
    }
  }
  await chrome.storage.local.set({ apiKey, baseUrl });
  show("fill");
  loadLists();
});

(async () => {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) {
    $("url").value = DEFAULT_BASE_URL;
    show("settings");
    return;
  }
  show("fill");
  loadLists();
})();
