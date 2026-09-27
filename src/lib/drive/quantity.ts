import { fold } from "./normalize";
import type { MatchProduct } from "./types";

/** Quantité ramenée à une unité de base : grammes, millilitres ou pièces. */
export interface Amount {
  value: number;
  unit: "g" | "ml" | "unit";
}

const FACTORS: Record<string, [number, Amount["unit"]]> = {
  mg: [0.001, "g"], g: [1, "g"], gr: [1, "g"], gramme: [1, "g"], grammes: [1, "g"], kg: [1000, "g"],
  ml: [1, "ml"], cl: [10, "ml"], dl: [100, "ml"], l: [1000, "ml"], litre: [1000, "ml"], litres: [1000, "ml"],
};

function parseNumber(raw: string): number | null {
  const fraction = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * « 500 g », « 1,5 kg », « 20 cl », « 3 », « 2 pièces », « x6 », « 1/2 l ».
 * Renvoie null pour ce qui ne se convertit pas (« 1 botte », « un peu »).
 */
export function parseAmount(text: string | null | undefined): Amount | null {
  if (!text) return null;
  const m = fold(text).trim().match(/^x?\s*(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*([a-z]*)\.?$/);
  if (!m) return null;
  const value = parseNumber(m[1]);
  if (value === null) return null;
  const unit = m[2];
  if (!unit || ["x", "piece", "pieces", "pc", "pcs", "unite", "unites"].includes(unit)) {
    return { value, unit: "unit" };
  }
  const factor = FACTORS[unit];
  return factor ? { value: value * factor[0], unit: factor[1] } : null;
}

/** Contenu d'un exemplaire commandé : un paquet, ou un palier pour les produits au poids. */
export function packAmount(p: MatchProduct): Amount | null {
  const byWeight = p.modeAchatVente === "poids";
  const value = byWeight ? p.poidsNet : p.mesure;
  const unit = byWeight ? p.poidsNetUnite : p.mesureUnite;
  if (!value || value <= 0 || !unit) return null;
  if (unit === "/kg") return { value: value * 1000, unit: "g" };
  if (unit === "/l") return { value: value * 1000, unit: "ml" };
  if (unit === "/unité" || unit === "/unite") return { value, unit: "unit" };
  return null;
}

export interface QuantityChoice {
  quantity: number;
  /** false quand la quantité demandée n'a pas pu être convertie (pièces contre poids, par exemple). */
  exact: boolean;
}

/**
 * Nombre d'exemplaires à commander pour couvrir le besoin, borné par les
 * limites du produit. On tolère 10 % de moins que demandé plutôt que
 * d'ajouter un paquet entier (400 g demandés, paquets de 250 g → 2).
 */
export function quantityToOrder(
  need: Amount | null,
  product: MatchProduct,
  fallback = 1
): QuantityChoice {
  const min = Math.max(1, product.quantiteMin ?? 1);
  const max = product.quantiteMax && product.quantiteMax > 0 ? product.quantiteMax : 99;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  if (!need) return { quantity: clamp(fallback), exact: true };

  const pack = packAmount(product);
  if (need.unit === "unit" && (!pack || pack.unit !== "unit" || pack.value === 1)) {
    // « 3 citrons » face à un citron à l'unité : 3. Face à un filet de 500 g,
    // on ne sait pas combien pèse un citron : 1 filet, à vérifier.
    if (pack && pack.unit !== "unit") return { quantity: clamp(1), exact: false };
    return { quantity: clamp(Math.round(need.value)), exact: true };
  }
  if (!pack || pack.unit !== need.unit) return { quantity: clamp(fallback), exact: false };

  return { quantity: clamp(Math.ceil(need.value / pack.value - 0.1)), exact: true };
}
