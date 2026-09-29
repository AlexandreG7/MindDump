/**
 * Disposition de l'accueil : quels modules sont affichés, dans quel ordre et à
 * quelle largeur. Enregistrée sur le compte (User.dashboardLayout) pour être la
 * même sur le téléphone et l'ordinateur.
 */

export const MODULE_IDS = ["today", "meals", "lists", "week", "weather"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** Largeur sur grand écran : un tiers, la moitié, deux tiers, toute la largeur. */
export const MODULE_SIZES = ["S", "M", "L", "XL"] as const;
export type ModuleSize = (typeof MODULE_SIZES)[number];

export interface ModuleSlot {
  id: ModuleId;
  visible: boolean;
  size: ModuleSize;
}

export const SIZE_LABELS: Record<ModuleSize, { short: string; long: string }> = {
  S: { short: "1/3", long: "Un tiers de la largeur" },
  M: { short: "1/2", long: "La moitié de la largeur" },
  L: { short: "2/3", long: "Deux tiers de la largeur" },
  XL: { short: "1/1", long: "Toute la largeur" },
};

export const MODULE_LABELS: Record<ModuleId, string> = {
  today: "Aujourd'hui",
  meals: "Au menu",
  lists: "Courses",
  week: "Cette semaine",
  weather: "Météo",
};

export const DEFAULT_LAYOUT: ModuleSlot[] = [
  { id: "today", visible: true, size: "L" },
  { id: "meals", visible: true, size: "S" },
  { id: "lists", visible: true, size: "S" },
  { id: "week", visible: true, size: "S" },
  { id: "weather", visible: true, size: "S" },
];

function isModuleId(v: unknown): v is ModuleId {
  return typeof v === "string" && (MODULE_IDS as readonly string[]).includes(v);
}

function isModuleSize(v: unknown): v is ModuleSize {
  return typeof v === "string" && (MODULE_SIZES as readonly string[]).includes(v);
}

/**
 * Disposition valide à partir de n'importe quelle valeur (base, requête) :
 * entrées inconnues ou en double ignorées, modules manquants ajoutés à la fin
 * avec leurs réglages par défaut (utile quand un nouveau module apparaît).
 */
export function normalizeLayout(value: unknown): ModuleSlot[] {
  const seen = new Set<ModuleId>();
  const slots: ModuleSlot[] = [];
  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const { id, visible, size } = raw as Record<string, unknown>;
      if (!isModuleId(id) || seen.has(id)) continue;
      seen.add(id);
      const fallback = DEFAULT_LAYOUT.find((d) => d.id === id)!;
      slots.push({
        id,
        visible: typeof visible === "boolean" ? visible : fallback.visible,
        size: isModuleSize(size) ? size : fallback.size,
      });
    }
  }
  for (const d of DEFAULT_LAYOUT) if (!seen.has(d.id)) slots.push({ ...d });
  return slots;
}
