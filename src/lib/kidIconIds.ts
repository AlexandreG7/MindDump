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
  // Ajouts (liste étendue) : toujours en fin de liste, jamais réordonnés ni renommés.
  { id: "apple", label: "pomme" },
  { id: "carrot", label: "carotte" },
  { id: "plate", label: "assiette et couverts" },
  { id: "sandwich", label: "sandwich" },
  { id: "ice-cream", label: "glace" },
  { id: "glass", label: "verre" },
  { id: "cat", label: "chat" },
  { id: "dog", label: "chien" },
  { id: "fish", label: "poisson" },
  { id: "bird", label: "oiseau" },
  { id: "rabbit", label: "lapin" },
  { id: "butterfly", label: "papillon" },
  { id: "school", label: "école" },
  { id: "slide", label: "toboggan" },
  { id: "beach", label: "parasol" },
  { id: "mountain", label: "montagne" },
  { id: "shop", label: "magasin" },
  { id: "bus", label: "bus" },
  { id: "train", label: "train" },
  { id: "plane", label: "avion" },
  { id: "scooter", label: "trottinette" },
  { id: "boat", label: "bateau" },
  { id: "blocks", label: "cubes" },
  { id: "teddy", label: "ours en peluche" },
  { id: "football", label: "ballon de football" },
  { id: "racket", label: "raquette" },
  { id: "guitar", label: "guitare" },
  { id: "drum", label: "tambour" },
  { id: "camera", label: "appareil photo" },
  { id: "tablet", label: "tablette" },
  { id: "clock", label: "horloge" },
  { id: "umbrella", label: "parapluie" },
  { id: "shoe", label: "chaussure" },
  { id: "hat", label: "chapeau" },
  { id: "crown", label: "couronne" },
  { id: "rocket", label: "fusée" },
  { id: "balloon", label: "ballons" },
  { id: "flag", label: "fanion" },
  { id: "pencil", label: "crayon" },
  { id: "trophy", label: "trophée" },
  { id: "bolt", label: "éclair" },
  { id: "flame", label: "flamme" },
  { id: "target", label: "cible" },
  // Visages (émotions uniquement, ADR 0002).
  { id: "face-surprised", label: "visage surpris" },
  { id: "face-laughing", label: "visage qui rit aux larmes" },
  { id: "face-in-love", label: "visage aux yeux en cœur" },
  { id: "face-tongue", label: "visage qui tire la langue" },
  { id: "face-cool", label: "visage avec lunettes de soleil" },
  { id: "face-worried", label: "visage inquiet" },
  { id: "face-crying", label: "visage qui pleure" },
  { id: "face-shy", label: "visage timide aux joues roses" },
  { id: "face-thinking", label: "visage pensif" },
  { id: "face-serene", label: "visage serein aux yeux fermés" },
  { id: "face-wink", label: "visage qui fait un clin d'œil" },
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
