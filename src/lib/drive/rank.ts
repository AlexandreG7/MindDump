import { fold, quantityInName, searchQuery, tokens } from "./normalize";
import { packAmount, parseAmount, quantityToOrder, type Amount } from "./quantity";
import type { MatchProduct, RememberedProduct, Suggestion } from "./types";

/**
 * Mots qui signalent un produit transformé ou dérivé : « jambon » ne doit pas
 * donner un sandwich, ni « tomate » une sauce. Pénalisés seulement s'ils ne
 * figurent pas dans l'article lui-même.
 */
const DERIVED = new Set(
  [
    "sauce", "jus", "soupe", "veloute", "potage", "bouillon", "chips", "biscuit", "gateau",
    "arome", "aromatise", "confiture", "compote", "sirop", "bonbon", "glace", "pizza",
    "tarte", "quiche", "nectar", "coulis", "ketchup", "pesto", "boisson", "sandwich",
    "wrap", "plat", "preparation", "tartinable", "rape", "surgele", "puree", "barre",
    "cereale", "dessert", "chocolat", "tablette", "regenerant", "nourriture",
  ].map((w) => tokens(w)[0])
);

/** Rayons non alimentaires : pénalisés sauf si l'article en relève visiblement. */
const NON_FOOD_DEPARTMENTS = ["d.p.h.", "dph", "bazar", "animalerie", "textile"];
const HOUSEHOLD = new Set(
  [
    "lessive", "papier", "toilette", "essuie", "vaisselle", "eponge", "sac", "poubelle",
    "shampoing", "shampooing", "douche", "dentifrice", "brosse", "couche", "lingette",
    "adoucissant", "javel", "nettoyant", "desodorisant", "mouchoir", "coton", "savon",
    "deodorant", "rasoir", "serviette", "aluminium", "film", "croquette", "litiere",
    "pastille", "tablette", "regenerant",
  ].map((w) => tokens(w)[0])
);

function isNonFood(p: MatchProduct): boolean {
  const department = fold(p.categories?.[0] ?? "");
  return NON_FOOD_DEPARTMENTS.some((d) => department.startsWith(d));
}

/** Correspondance d'un mot de l'article dans le produit : 1 dans le nom, 0,7 dans le rayon. */
function tokenMatch(word: string, title: Set<string>, category: Set<string>): number {
  if (title.has(word)) return 1;
  for (const t of Array.from(title)) {
    if (word.length >= 4 && t.length >= 4 && (t.startsWith(word) || word.startsWith(t))) return 0.8;
  }
  if (category.has(word)) return 0.7;
  return 0;
}

interface Scored {
  product: MatchProduct;
  score: number;
  coverage: number;
  penalty: number;
}

function scoreProduct(query: string[], need: Amount | null, p: MatchProduct, index: number, total: number): Scored {
  const title = new Set(tokens(`${p.nom} ${p.legalName ?? ""}`));
  const category = new Set(tokens(`${p.rubrique ?? ""} ${(p.categories ?? []).join(" ")}`));
  const querySet = new Set(query);

  const coverage = query.length
    ? query.reduce((sum, w) => sum + tokenMatch(w, title, category), 0) / query.length
    : 0;

  let penalty = 0;
  const derived = Array.from(title).filter((w) => DERIVED.has(w) && !querySet.has(w)).length;
  penalty += Math.min(0.6, derived * 0.35);
  if (isNonFood(p) && !query.some((w) => HOUSEHOLD.has(w))) penalty += 0.3;
  // À correspondance égale, le produit le plus simple (« Tomate cerise » plutôt
  // que « Tomate cerise allongée duo barquette »).
  const brand = new Set(tokens(p.marque ?? ""));
  const extra = tokens(p.nom).filter((w) => !querySet.has(w) && !brand.has(w)).length;
  penalty += Math.min(0.15, extra * 0.02);
  if (p.sponso) penalty += 0.05;

  // Format qui colle au besoin : 2 kg demandés, un sac de 2 kg plutôt que
  // deux sacs de 1 kg ou un de 5 kg.
  const pack = packAmount(p);
  let fit = 0;
  if (need && pack && pack.unit === need.unit && need.unit !== "unit") {
    const packs = Math.max(1, Math.ceil(need.value / pack.value - 0.1));
    fit = 0.1 * (Math.min(need.value, packs * pack.value) / Math.max(need.value, packs * pack.value)) - 0.03 * (packs - 1);
  }

  // L'ordre du moteur de recherche Match départage le reste.
  const position = total > 1 ? 0.08 * (1 - index / (total - 1)) : 0.08;
  return { product: p, score: coverage - penalty + fit + position, coverage, penalty };
}

/**
 * Classe les résultats de recherche Match pour un article de liste de courses.
 * Le produit déjà retenu par le groupe passe toujours en tête s'il est
 * disponible. Les produits indisponibles sont écartés.
 */
export function rankCandidates(
  item: { name: string; quantity?: string | null },
  candidates: MatchProduct[],
  remembered?: RememberedProduct | null
): Suggestion[] {
  const query = tokens(searchQuery(item.name));
  const need = parseAmount(item.quantity) ?? parseAmount(quantityInName(item.name));
  const available = candidates.filter((p) => p.disponible !== false);

  const scored = available.map((p, i) => scoreProduct(query, need, p, i, available.length));
  scored.sort((a, b) => b.score - a.score);

  const suggestions = scored.map((s, i): Suggestion => {
    const isRemembered = !!remembered && s.product.sku === remembered.sku;
    const q = quantityToOrder(need, s.product, isRemembered ? remembered!.quantity : 1);
    let confidence = Math.max(0, Math.min(1, s.coverage - s.penalty));
    if (i === 0 && scored[1] && s.score - scored[1].score < 0.02 && s.coverage < 1) {
      // Deux produits presque ex æquo sans correspondance complète : on demande.
      confidence = Math.min(confidence, 0.6);
    }
    if (isRemembered) confidence = 1;
    return {
      product: s.product,
      score: isRemembered ? Number.POSITIVE_INFINITY : s.score,
      confidence: Math.round(confidence * 100) / 100,
      quantity: q.quantity,
      quantityUncertain: !q.exact,
      remembered: isRemembered,
    };
  });

  return suggestions.sort((a, b) => b.score - a.score);
}
