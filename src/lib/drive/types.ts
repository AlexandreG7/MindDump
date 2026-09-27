/**
 * Produit Match tel que le script côté site l'extrait des résultats de
 * recherche (produits.supermarchesmatch.fr/pred/simplePageContent), réduit aux
 * champs utiles. Voir docs/drive-match.md.
 */
export interface MatchProduct {
  sku: string;
  ean?: string | null;
  nom: string;
  marque?: string | null;
  legalName?: string | null;
  prix?: number | null;
  prixUnite?: number | null;
  /** Contenu d'un paquet, dans mesureUnite (0.25 + « /kg » = 250 g). */
  mesure?: number | null;
  mesureUnite?: string | null;
  /** Pour les produits au poids : contenu d'un palier. */
  poidsNet?: number | null;
  poidsNetUnite?: string | null;
  conditionnement?: string | null;
  disponible?: boolean | null;
  bio?: boolean | null;
  image?: string | null;
  rubrique?: string | null;
  /** Nomenclature, du rayon au sous-type : ["CREMERIE", …, "LAIT UHT 1/2 ECREME"]. */
  categories?: string[] | null;
  /** « unité » ou « poids ». */
  modeAchatVente?: string | null;
  quantiteMin?: number | null;
  quantiteMax?: number | null;
  sponso?: boolean | null;
}

/** Produit déjà retenu par le groupe pour un article. */
export interface RememberedProduct {
  sku: string;
  quantity: number;
}

export interface Suggestion {
  product: MatchProduct;
  /** Score interne de classement. */
  score: number;
  /** Confiance entre 0 et 1 ; en dessous de REVIEW_THRESHOLD, on demande. */
  confidence: number;
  quantity: number;
  /** La quantité demandée n'a pas pu être convertie : à vérifier. */
  quantityUncertain: boolean;
  remembered: boolean;
}

export const REVIEW_THRESHOLD = 0.7;
