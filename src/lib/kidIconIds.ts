/**
 * Bibliothèque d'images du semainier : identifiants figés (données pures, sans
 * React, importables côté client comme côté serveur). Les dessins sont dans
 * src/components/kids/icons.tsx. Aucune image médicale ou corporelle : voir
 * docs/semainier/02-plan-technique.md.
 */
export const KID_ICONS = [
  { id: "sun", label: "soleil" },
  { id: "sun-cloud", label: "soleil et nuage" },
  { id: "cloud", label: "nuage" },
  { id: "rain", label: "pluie" },
  { id: "storm", label: "orage" },
  { id: "snow", label: "neige" },
  { id: "moon", label: "lune" },
  { id: "star", label: "étoile" },
  { id: "rainbow", label: "arc-en-ciel" },
  { id: "drop", label: "goutte" },
  { id: "leaf", label: "feuille" },
  { id: "flower", label: "fleur" },
  { id: "tree", label: "arbre" },
  { id: "face-very-happy", label: "visage très content" },
  { id: "face-happy", label: "visage content" },
  { id: "face-neutral", label: "visage neutre" },
  { id: "face-sad", label: "visage triste" },
  { id: "face-angry", label: "visage fâché" },
  { id: "brush", label: "pinceau" },
  { id: "book", label: "livre" },
  { id: "ball", label: "ballon" },
  { id: "music", label: "note de musique" },
  { id: "puzzle", label: "puzzle" },
  { id: "pan", label: "casserole" },
  { id: "wave", label: "vague" },
  { id: "people", label: "personnes" },
  { id: "scissors", label: "ciseaux" },
  { id: "paw", label: "patte" },
  { id: "mask", label: "masque" },
  { id: "bike", label: "vélo" },
  { id: "car", label: "voiture" },
  { id: "house", label: "maison" },
  { id: "backpack", label: "cartable" },
  { id: "cake", label: "gâteau" },
  { id: "heart", label: "cœur" },
  { id: "cup", label: "tasse" },
  { id: "check", label: "coche" },
  { id: "cross", label: "croix" },
  { id: "bell", label: "cloche" },
  { id: "gift", label: "cadeau" },
] as const;

export type KidIconId = (typeof KID_ICONS)[number]["id"];

export const KID_ICON_IDS: readonly string[] = KID_ICONS.map((i) => i.id);

export function isKidIconId(value: unknown): value is KidIconId {
  return typeof value === "string" && KID_ICON_IDS.includes(value);
}

/** Libellé accessible, purement descriptif, d'une image de la bibliothèque. */
export function kidIconLabel(id: string): string {
  return KID_ICONS.find((i) => i.id === id)?.label ?? "image";
}
