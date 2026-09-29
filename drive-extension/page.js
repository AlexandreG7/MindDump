// Exécuté dans la page Match (monde principal) : seul contexte qui voit l'app
// Nuxt du site. Il n'expose que deux opérations au script de l'extension :
// lire le contexte (magasin choisi, connexion) et ajouter des produits au
// panier avec l'action du site lui-même, qui gère le compte, l'id de panier
// et l'affichage.
(() => {
  const SOURCE_IN = "minddump-drive:content";
  const SOURCE_OUT = "minddump-drive:page";

  function nuxtApp() {
    const app = document.querySelector("#__nuxt")?.__vue_app__;
    return app?.$nuxt || app?.config?.globalProperties?.$nuxt || null;
  }

  function context() {
    const nuxt = nuxtApp();
    const store = nuxt?.$store;
    if (!store) return { ready: false };
    const selected = store.state?.boutiques?.selected;
    const boutiqueId = String(store.getters?.["boutiques/boutiqueId"] ?? "");
    const client = store.getters?.["compte/client"];
    return {
      ready: true,
      boutiqueId,
      boutiqueName: selected?.libelle ?? null,
      // 9999 = catalogue web par défaut, aucun magasin choisi.
      storeChosen: !!boutiqueId && boutiqueId !== "9999",
      loggedIn: !!(client && (client.id || client.numeroClient || client.email)),
      cartCount: store.state?.panier?.panier?.nbProduits ?? null,
      device: window.innerWidth < 768 ? "mobile" : "desktop",
    };
  }

  async function addToCart(products) {
    const store = nuxtApp()?.$store;
    if (!store) throw new Error("Le site Match n'est pas prêt, recharge la page.");
    const payload = products.map((p) => ({
      sku: String(p.sku),
      produitQuantite: Number(p.quantity),
      modeAchatVente: p.modeAchatVente || "unité",
    }));
    await store.dispatch("panier/addProduits", payload);
    return { cartCount: store.state?.panier?.panier?.nbProduits ?? null };
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.source !== SOURCE_IN) return;
    const { id, action, products } = event.data;
    const reply = (result) => window.postMessage({ source: SOURCE_OUT, id, ...result }, window.location.origin);
    try {
      if (action === "context") reply({ ok: true, data: context() });
      else if (action === "addToCart") reply({ ok: true, data: await addToCart(products || []) });
      else reply({ ok: false, error: "Action inconnue" });
    } catch (e) {
      const detail = e?.detail || e?.message || (typeof e === "string" ? e : null);
      reply({ ok: false, error: detail || "L'ajout au panier a échoué." });
    }
  });
})();
