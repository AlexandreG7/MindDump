/**
 * Normalisation des libellés d'articles et de produits, commune à la clé de
 * mémorisation (DriveProduct.key) et au classement des résultats de recherche.
 */

const STOPWORDS = new Set([
  "de", "du", "des", "la", "le", "les", "l", "d", "a", "au", "aux", "et", "en",
  "pour", "un", "une", "avec", "sans", "sur", "ou", "par",
]);

const UNIT_TOKENS = new Set([
  "g", "gr", "kg", "mg", "ml", "cl", "dl", "l", "x", "pc", "pcs", "piece", "pieces",
  "unite", "unites", "env", "litre", "litres", "gramme", "grammes",
]);

/** Minuscules, sans accents ni ligatures. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Singulier approximatif, appliqué de la même façon des deux côtés. */
function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("eaux")) return word.slice(0, -1); // poireaux → poireau
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word; // « doux », « noix », « riz » restent tels quels
}

/**
 * Mots significatifs : sans mots outils, nombres ni unités, au singulier.
 * « 500 g de Tomates cerises (bio) » → ["tomate", "cerise", "bio"].
 */
export function tokens(text: string): string[] {
  return fold(text)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w) && !UNIT_TOKENS.has(w) && !/^\d/.test(w))
    .map(singular);
}

// Quantité en tête ou en fin de libellé : « 2 citrons », « 500 g de farine »,
// « farine 1kg », « œufs x6 ».
const QTY_PREFIX = /^\s*(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*(kg|g|gr|mg|l|cl|ml|dl|x)?\.?\s+(?:(?:de|d')\s*)?/i;
const QTY_SUFFIX = /\s+(?:x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gr|mg|l|cl|ml|dl|x)?\.?\s*$/i;

/** Libellé sans quantité ni parenthèses, pour la recherche : « 500 g de farine » → « farine ». */
export function searchQuery(name: string): string {
  const cleaned = name
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "Oe")
    .replace(/\([^)]*\)/g, " ")
    .replace(QTY_PREFIX, "")
    .replace(QTY_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name.trim();
}

/** Clé de mémorisation d'un article : « Tomates cerises » et « tomate cerise » donnent la même. */
export function itemKey(name: string): string {
  return tokens(searchQuery(name)).join(" ");
}

/** Quantité écrite dans le libellé lui-même (« 2 citrons »), si le champ quantité est vide. */
export function quantityInName(name: string): string | null {
  const prefix = name.match(QTY_PREFIX);
  if (prefix) return `${prefix[1]} ${prefix[2] ?? ""}`.trim();
  const suffix = name.match(QTY_SUFFIX);
  if (suffix) return `${suffix[1]} ${suffix[2] ?? ""}`.trim();
  return null;
}
