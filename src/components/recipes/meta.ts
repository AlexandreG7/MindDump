// Petites règles d'affichage partagées par le catalogue, la fiche et le mode cuisine.

export type RecipeSource = "hellofresh" | "jow" | "quitoque" | "perso";

export const SOURCE_LABELS: Record<RecipeSource, string> = {
  hellofresh: "HelloFresh",
  jow: "Jow",
  quitoque: "Quitoque",
  perso: "Perso",
};

/**
 * Origine d'une recette. Le modèle ne mémorise pas la source : on la déduit de
 * l'hébergeur de la photo importée (les imports gardent l'image distante).
 * Une photo téléversée, ou l'absence de photo, donne « perso ».
 */
export function recipeSource(image: string | null | undefined): RecipeSource {
  const url = (image ?? "").toLowerCase();
  if (url.includes("hellofresh")) return "hellofresh";
  if (url.includes("jow")) return "jow";
  if (url.includes("quitoque")) return "quitoque";
  return "perso";
}

export function totalMinutes(r: { prepTime: number | null; cookTime: number | null }): number {
  return (r.prepTime || 0) + (r.cookTime || 0);
}

/** 75 → « 1 h 15 », 40 → « 40 min ». */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export interface RecipeStep {
  text: string;
  image: string | null;
}

export function parseSteps(raw: string): RecipeStep[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s: string | { text: string; image?: string }) =>
      typeof s === "string" ? { text: s, image: null } : { text: s.text, image: s.image || null }
    );
  } catch {
    return [];
  }
}

/** Quantité multipliée par le nombre de portions choisi (« 1,5 » en français). */
export function scaleQuantity(qty: string, multiplier: number): string {
  if (multiplier === 1) return qty;
  const num = parseFloat(qty.replace(",", "."));
  if (isNaN(num)) return qty;
  const result = num * multiplier;
  return result % 1 === 0 ? String(result) : result.toFixed(1).replace(".", ",");
}

const COUNTABLE_UNITS = ["pincée", "gousse", "tranche", "feuille", "brin", "cuillère", "branche", "boîte", "sachet", "tige", "poignée", "morceau", "bouquet", "verre"];

/**
 * Unité accordée à la quantité affichée : « 2 pincées », « 1 pincée », « 0,5 pincée ».
 * Seules les unités dénombrables courantes sont accordées (g, ml, cl… ne bougent pas).
 */
export function agreeUnit(unit: string, quantity: string): string {
  const [head, ...rest] = unit.trim().split(/\s+/);
  const singular = head.toLowerCase().replace(/s$/, "");
  if (!COUNTABLE_UNITS.includes(singular)) return unit;
  const n = parseFloat(quantity.replace(",", "."));
  if (isNaN(n)) return unit;
  const word = n >= 2 ? `${singular}s` : singular;
  return [head[0] === head[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word, ...rest].join(" ");
}

/**
 * Durées citées dans une étape (« 12 minutes », « 1 heure », « 10 à 15 min ») :
 * le mode cuisine propose un minuteur d'un appui pour chacune. Pour une
 * fourchette, on retient la borne basse (on surveille ensuite la cuisson).
 */
export function detectTimers(text: string): { seconds: number; label: string }[] {
  const found: number[] = [];
  const add = (min: number) => {
    if (min >= 1 && min <= 360 && found.indexOf(min) === -1) found.push(min);
  };
  let m: RegExpExecArray | null;
  // « 1 h 30 », « 2 heures » ; puis « 12 minutes », « 10 à 15 min ».
  const hours = /(\d+)\s*(?:heures?|h)\b(?:\s*(\d{1,2})\b(?!\s*(?:°|%|g\b|cl\b|ml\b|kg\b)))?/gi;
  while ((m = hours.exec(text))) add(parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0));
  const minutes = /(\d+)\s*(?:(?:à|-|–)\s*\d+\s*)?(?:minutes?|min)\b/gi;
  while ((m = minutes.exec(text))) add(parseInt(m[1], 10));
  return found.slice(0, 3).map((min) => ({ seconds: min * 60, label: formatMinutes(min) }));
}
