// Script de l'extension sur supermarchesmatch.fr (monde isolé).
// Déroulé : plan MindDump → recherche Match pour chaque article → classement
// MindDump → écran de revue → ajout au panier par le site → mémorisation.
// Le paiement et le choix du créneau restent sur le site Match.
(() => {
  const SEARCH_URL = "https://produits.supermarchesmatch.fr/pred/simplePageContent";
  const IMAGE_URL = (sku) => `https://api-drive.drive.supermarchesmatch.fr/image/sku/grille/${sku}@2x.avif`;
  const CART_PATH = "/fr/panier";
  const CANDIDATES = 20;
  const PARALLEL = 4;
  const MIN_CONFIDENCE = 0.5;

  // ---------------------------------------------------------------- échanges

  function api(method, path, body) {
    return chrome.runtime.sendMessage({ type: "api", method, path, body });
  }

  let pageSeq = 0;
  function page(action, extra = {}, timeout = 20000) {
    const id = `${Date.now()}-${++pageSeq}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve({ ok: false, error: "Le site Match ne répond pas, recharge la page." });
      }, timeout);
      function onMessage(event) {
        if (event.source !== window || event.data?.source !== "minddump-drive:page" || event.data.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(event.data);
      }
      window.addEventListener("message", onMessage);
      window.postMessage({ source: "minddump-drive:content", id, action, ...extra }, window.location.origin);
    });
  }

  const parse = (v) => {
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch { return null; }
  };

  // Champs utiles d'un résultat de recherche Match (voir src/lib/drive/types.ts).
  function slim(s) {
    return {
      sku: s.sku, ean: s.ean, nom: s.nom, marque: s.marque, legalName: s.legalName,
      prix: s.prix, prixUnite: s.prixUnite, mesure: s.mesure, mesureUnite: s.mesureUnite,
      poidsNet: s.poidsNet, poidsNetUnite: s.poidsNetUnite, conditionnement: s.conditionnement,
      disponible: s.disponible, bio: s.bio, image: s.image,
      rubrique: parse(s.rubriquePrincipale)?.label ?? null,
      categories: (parse(s.masterCategories) || []).map((c) => c.label),
      modeAchatVente: s.modeAchatVente, quantiteMin: s.quantiteMin, quantiteMax: s.quantiteMax,
      sponso: s.sponso,
    };
  }

  async function search(query, ctx) {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleVersion: "drive",
        region: "fr_FR",
        sessionId: `minddump-${Date.now()}`,
        advanced: { device: ctx.device, store: Number(ctx.boutiqueId) || ctx.boutiqueId },
        pageId: 0,
        parameters: { page: 1, query, filters: null, sortingCode: null },
      }),
    });
    if (!res.ok) throw new Error(`Recherche Match : erreur ${res.status}`);
    const data = await res.json();
    return (data.slots || []).filter((s) => s._type === "produit").slice(0, CANDIDATES).map(slim);
  }

  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  // ---------------------------------------------------------------- panneau

  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .panel { position: fixed; top: 16px; right: 16px; bottom: 16px; width: min(440px, calc(100vw - 32px));
      z-index: 2147483647; display: flex; flex-direction: column; background: #fff; color: #1c1917;
      border: 1px solid #e7e5e4; border-radius: 14px; box-shadow: 0 20px 50px rgba(0,0,0,.18); overflow: hidden; }
    header { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #f0efee; }
    header h1 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; }
    header small { display: block; font-weight: 400; color: #78716c; font-size: 12px; margin-top: 2px; }
    button { font: inherit; cursor: pointer; }
    .icon { border: 0; background: transparent; width: 28px; height: 28px; border-radius: 8px; color: #78716c; font-size: 18px; line-height: 1; }
    .icon:hover { background: #f5f5f4; color: #1c1917; }
    .body { flex: 1; overflow-y: auto; padding: 8px 0; }
    .status { padding: 24px 16px; color: #57534e; font-size: 14px; text-align: center; }
    .warn { margin: 8px 16px; padding: 10px 12px; border-radius: 10px; background: #fef3c7; color: #78350f; font-size: 13px; }
    .error { background: #fee2e2; color: #7f1d1d; }
    .row { padding: 10px 16px; border-bottom: 1px solid #f5f5f4; }
    .row.off { opacity: .45; }
    .line { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .line label { flex: 1; display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500; }
    .qty-need { color: #78716c; font-weight: 400; }
    .badge { font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #fef3c7; color: #92400e; white-space: nowrap; }
    .badge.mem { background: #dcfce7; color: #166534; }
    .product { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
    .product img { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; background: #fafaf9; flex: none; }
    .info { flex: 1; min-width: 0; }
    .name { font-size: 13px; line-height: 1.3; }
    .meta { font-size: 12px; color: #78716c; margin-top: 2px; }
    select { width: 100%; margin-top: 6px; font: inherit; font-size: 12px; padding: 5px 6px; border: 1px solid #e7e5e4; border-radius: 8px; background: #fff; color: #1c1917; }
    .stepper { display: flex; align-items: center; border: 1px solid #e7e5e4; border-radius: 8px; flex: none; }
    .stepper button { border: 0; background: transparent; width: 26px; height: 28px; color: #44403c; }
    .stepper span { min-width: 22px; text-align: center; font-size: 13px; font-variant-numeric: tabular-nums; }
    .none { margin-top: 6px; font-size: 12px; color: #78716c; }
    footer { padding: 12px 16px; border-top: 1px solid #f0efee; display: flex; align-items: center; gap: 12px; }
    footer .total { flex: 1; font-size: 13px; color: #57534e; }
    footer .total strong { color: #1c1917; font-variant-numeric: tabular-nums; }
    .primary { border: 0; border-radius: 10px; padding: 10px 14px; background: #15803d; color: #fff; font-weight: 600; font-size: 14px; }
    .primary:disabled { background: #a8a29e; cursor: default; }
    .done { padding: 28px 16px; text-align: center; font-size: 14px; color: #44403c; line-height: 1.5; }
    .done a { display: inline-block; margin-top: 12px; color: #15803d; font-weight: 600; text-decoration: none; }
    @media (prefers-color-scheme: dark) {
      .panel { background: #1c1917; color: #f5f5f4; border-color: #292524; }
      header, footer { border-color: #292524; } .row { border-color: #292524; }
      .icon:hover { background: #292524; color: #fff; }
      select, .stepper { background: #1c1917; color: #f5f5f4; border-color: #44403c; }
      .stepper button { color: #d6d3d1; } footer .total strong { color: #fff; }
      .product img { background: #292524; } .done { color: #d6d3d1; }
      header small, .qty-need, .meta, .none, .icon, footer .total, .status { color: #a8a29e; }
    }`;

  let host = null;
  let root = null;
  let state = null;

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) node.append(c);
    return node;
  }

  function openPanel() {
    host?.remove();
    host = document.createElement("minddump-drive");
    root = host.attachShadow({ mode: "closed" });
    document.documentElement.append(host);
  }

  function close() {
    host?.remove();
    host = null;
    state = null;
  }

  const euros = (n) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  function productMeta(p) {
    return [p.marque, p.conditionnement, p.prix != null ? euros(p.prix) : null].filter(Boolean).join(" · ");
  }

  function render(content) {
    const header = el("header", {},
      el("h1", {}, "Panier Match", state?.list ? el("small", {}, `Depuis « ${state.list.name} »`) : null),
      el("button", { class: "icon", "aria-label": "Fermer", title: "Fermer", onclick: close }, "×"));
    root.replaceChildren(el("style", {}, STYLE), el("div", { class: "panel", role: "dialog", "aria-label": "Panier Match" }, header, ...content));
  }

  function renderStatus(text, warning) {
    render([el("div", { class: "body" }, warning ? el("div", { class: "warn error" }, warning) : null, text ? el("div", { class: "status" }, text) : null)]);
  }

  function selected(row) {
    return row.suggestions[row.choice] || null;
  }

  function renderReview() {
    const rows = state.rows;
    const chosen = rows.filter((r) => r.include && selected(r));
    const total = chosen.reduce((sum, r) => sum + (selected(r).product.prix || 0) * r.quantity, 0);
    const toReview = rows.filter((r) => selected(r) && r.needsReview).length;

    const list = rows.map((row, index) => {
      const s = selected(row);
      const toggle = el("input", {
        type: "checkbox", checked: row.include, disabled: !s,
        onchange: (e) => { row.include = e.target.checked; renderReview(); },
      });
      const badges = [
        s?.remembered ? el("span", { class: "badge mem", title: "Produit déjà choisi pour cet article" }, "habituel") : null,
        s && row.needsReview ? el("span", { class: "badge" }, "à vérifier") : null,
      ];
      const need = row.item.quantity ? el("span", { class: "qty-need" }, `· ${row.item.quantity}`) : null;
      const line = el("div", { class: "line" }, el("label", {}, toggle, el("span", {}, row.item.name, " ", need)), ...badges);
      if (!s) return el("div", { class: "row off" }, line, el("div", { class: "none" }, "Aucun produit trouvé sur Match"));

      const stepper = el("div", { class: "stepper" },
        el("button", { "aria-label": "Moins", onclick: () => { row.quantity = Math.max(1, row.quantity - 1); renderReview(); } }, "−"),
        el("span", {}, String(row.quantity)),
        el("button", { "aria-label": "Plus", onclick: () => { row.quantity = Math.min(99, row.quantity + 1); renderReview(); } }, "+"));
      const alternatives = row.suggestions.length > 1
        ? el("select", {
            "aria-label": `Autres produits pour ${row.item.name}`,
            onchange: (e) => {
              row.choice = Number(e.target.value);
              row.quantity = selected(row).quantity;
              row.needsReview = false; // choisi à la main
              renderReview();
            },
          }, row.suggestions.map((alt, i) => {
            const opt = el("option", { value: String(i) }, `${alt.product.nom} — ${productMeta(alt.product)}`);
            opt.selected = i === row.choice;
            return opt;
          }))
        : null;
      return el("div", { class: `row${row.include ? "" : " off"}`, "data-index": String(index) }, line,
        el("div", { class: "product" },
          el("img", { src: IMAGE_URL(s.product.sku), alt: "", loading: "lazy" }),
          el("div", { class: "info" }, el("div", { class: "name" }, s.product.nom), el("div", { class: "meta" }, productMeta(s.product))),
          stepper),
        alternatives);
    });

    const warnings = [
      !state.ctx.loggedIn ? el("div", { class: "warn" }, "Tu n'es pas connecté à Match : le panier sera rattaché à ton compte quand tu te connecteras.") : null,
      toReview ? el("div", { class: "warn" }, `${toReview} article${toReview > 1 ? "s" : ""} à vérifier : produit ou quantité incertain.`) : null,
    ];

    const button = el("button", { class: "primary", disabled: !chosen.length || state.busy, onclick: addToCart },
      state.busy ? "Ajout…" : `Ajouter ${chosen.length} produit${chosen.length > 1 ? "s" : ""}`);
    render([
      el("div", { class: "body" }, ...warnings, ...list),
      el("footer", {}, el("div", { class: "total" }, "Total estimé ", el("strong", {}, euros(total))), button),
    ]);
  }

  // ---------------------------------------------------------------- déroulé

  async function start(listId) {
    openPanel();
    state = { list: null, rows: [], busy: false, ctx: null };
    renderStatus("Préparation…");

    const ctx = await page("context");
    if (!ctx.ok || !ctx.data?.ready) return renderStatus(null, ctx.error || "Le site Match n'est pas prêt, recharge la page.");
    if (!ctx.data.storeChosen) return renderStatus(null, "Choisis d'abord ton magasin sur Match (« Choisir un magasin »), puis relance : les produits et les prix en dépendent.");
    state.ctx = ctx.data;

    const plan = await api("GET", `/api/drive/match/plan?listId=${encodeURIComponent(listId)}`);
    if (!plan.ok) return renderStatus(null, plan.error);
    state.list = plan.data.list;
    const items = plan.data.items;
    if (!items.length) return renderStatus("Tout est déjà coché dans cette liste.");

    let done = 0;
    renderStatus(`Recherche des produits… 0/${items.length}`);
    const candidates = await mapLimit(items, PARALLEL, async (item) => {
      let products = [];
      try { products = await search(item.query, state.ctx); } catch { /* article sans résultat */ }
      renderStatus(`Recherche des produits… ${++done}/${items.length}`);
      return { itemId: item.id, candidates: products };
    });

    const ranked = await api("POST", "/api/drive/match/rank", { listId, items: candidates });
    if (!ranked.ok) return renderStatus(null, ranked.error);
    const byItem = new Map(ranked.data.items.map((r) => [r.itemId, r]));

    state.rows = items.map((item) => {
      const r = byItem.get(item.id) || { suggestions: [], needsReview: true };
      const first = r.suggestions[0];
      // Correspondance très incertaine (« truffe blanche » → jambon à la truffe) :
      // proposée, mais décochée par défaut.
      const include = !!first && (first.remembered || first.confidence >= MIN_CONFIDENCE);
      return { item, suggestions: r.suggestions, choice: 0, quantity: first?.quantity ?? 1, include, needsReview: r.needsReview };
    });
    renderReview();
  }

  async function addToCart() {
    const rows = state.rows.filter((r) => r.include && selected(r));
    if (!rows.length) return;
    state.busy = true;
    renderReview();

    const products = rows.map((r) => ({ sku: selected(r).product.sku, quantity: r.quantity, modeAchatVente: selected(r).product.modeAchatVente }));
    const result = await page("addToCart", { products }, 20000 + products.length * 8000);
    const addedSkus = new Set(result.ok ? result.data.added : []);
    const done = rows.filter((r) => addedSkus.has(String(selected(r).product.sku)));
    const failed = rows.filter((r) => !addedSkus.has(String(selected(r).product.sku)));
    if (!done.length) {
      state.busy = false;
      renderReview();
      const detail = result.ok ? result.data.failed[0]?.error : result.error;
      root.querySelector(".body")?.prepend(el("div", { class: "warn error" }, `Match a refusé l'ajout : ${detail || "aucune confirmation"}`));
      return;
    }

    // Mémorisé seulement une fois au panier : c'est ce qui a vraiment été choisi.
    await api("PUT", "/api/drive/match/products", {
      listId: state.list.id,
      choices: done.map((r) => ({ itemId: r.item.id, product: selected(r).product, quantity: r.quantity })),
    });

    render([el("div", { class: "done" },
      el("div", {}, `${done.length} produit${done.length > 1 ? "s" : ""} ajouté${done.length > 1 ? "s" : ""} au panier.`),
      failed.length ? el("div", { class: "warn error" }, `Non ajouté${failed.length > 1 ? "s" : ""} : ${failed.map((r) => selected(r).product.nom).join(", ")}`) : null,
      el("div", {}, "Il te reste à choisir le créneau et à payer sur Match."),
      el("a", { href: CART_PATH }, "Voir mon panier →"))]);
  }

  function launch(listId) {
    start(listId).catch((e) => renderStatus(null, e?.message || "Erreur inattendue."));
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "fill" || typeof message.listId !== "string") return false;
    launch(message.listId);
    sendResponse({ ok: true });
    return false;
  });

  // Page ouverte (ou rechargée) par l'extension : la liste à traiter attend ici.
  chrome.runtime.sendMessage({ type: "takeFill" }).then((res) => res?.listId && launch(res.listId)).catch(() => {});
})();
