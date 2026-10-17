export const SIDEBAR_STORAGE_KEY = "sidebarCollapsed";

/** Sous cette largeur, la barre latérale est repliée tant qu'aucun choix n'est enregistré. */
export const SIDEBAR_AUTO_COLLAPSE_QUERY = "(max-width: 1099.98px)";

/**
 * Inlined in <head> : pose data-sidebar="collapsed" | "expanded" sur <html> avant
 * le premier rendu (le CSS replie la barre d'après cet attribut, sans saut).
 * Un choix enregistré l'emporte ; sinon la largeur de la fenêtre décide.
 */
export const sidebarInitScript = `(function(){try{var s=null;try{s=localStorage.getItem("${SIDEBAR_STORAGE_KEY}")}catch(e){}var c=s==="true"||(s!=="false"&&window.matchMedia("${SIDEBAR_AUTO_COLLAPSE_QUERY}").matches);document.documentElement.setAttribute("data-sidebar",c?"collapsed":"expanded");}catch(e){}})();`;
