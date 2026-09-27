import { isJowUrl } from "./jow";

/**
 * Contenu reçu par le menu Partager (share_target du manifest, page /partager).
 * Selon l'app qui partage, le lien arrive dans `url`, ou seulement dans `text`
 * (souvent sur Android), parfois précédé du titre.
 */
export type SharedContent = { title: string; text: string; url: string | null };

export type RecipeSource = "hellofresh" | "jow" | "quitoque";

const IMPORT_ROUTES: Record<RecipeSource, string> = {
  hellofresh: "/api/recipes/import-hellofresh",
  jow: "/api/recipes/import-jow",
  quitoque: "/api/recipes/import-quitoque",
};

export const RECIPE_SOURCE_NAMES: Record<RecipeSource, string> = {
  hellofresh: "HelloFresh",
  jow: "Jow",
  quitoque: "Quitoque",
};

export function readShared(params: URLSearchParams): SharedContent {
  const title = params.get("title")?.trim() ?? "";
  const text = params.get("text")?.trim() ?? "";
  const url =
    params.get("url")?.trim() || text.match(/https?:\/\/\S+/)?.[0] || title.match(/https?:\/\/\S+/)?.[0];
  return { title, text, url: url || null };
}

export function recipeSource(url: string | null): RecipeSource | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  // hellofresh.fr, .com, .be, .co.uk… mais pas hellofresh.fr.autre-site.com
  if (/(^|\.)hellofresh\.(?:[a-z]{2,3}|co\.uk|com\.au)$/.test(host)) return "hellofresh";
  if (/(^|\.)jow\.fr$/.test(host) && isJowUrl(url)) return "jow";
  if (/(^|\.)quitoque\.fr$/.test(host)) return "quitoque";
  return null;
}

export function importRoute(source: RecipeSource) {
  return IMPORT_ROUTES[source];
}

/** Titre de tâche : le titre partagé, sinon le texte sans le lien, sinon le lien. */
export function todoTitle({ title, text, url }: SharedContent): string {
  const textWithoutUrl = url ? text.replace(url, "").trim() : text;
  return (title || textWithoutUrl || url || "").slice(0, 200);
}
