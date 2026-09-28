/** Repas planifiés : créneaux, validation et regroupement des ingrédients pour les courses. */

/** Champs renvoyés par l'API pour un repas prévu. */
export const mealSelect = {
  id: true,
  date: true,
  slot: true,
  note: true,
  servings: true,
  groupId: true,
  recipe: { select: { id: true, title: true, image: true, servings: true, prepTime: true, cookTime: true } },
} as const;

export const MEAL_SLOTS = [
  { value: "lunch", label: "Midi" },
  { value: "dinner", label: "Soir" },
] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number]["value"];

export function isMealSlot(value: unknown): value is MealSlot {
  return value === "lunch" || value === "dinner";
}

/** Jour du calendrier « yyyy-MM-dd » valide. */
export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** « 1 », « 1,5 », « 0.5 », « 1/2 », « 1 1/2 » → nombre ; sinon null. */
export function parseQuantity(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(s);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

function formatQuantity(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace(".", ",");
}

export interface IngredientLine {
  name: string;
  quantity: string;
  unit: string | null;
  /** Proportion à appliquer (portions prévues / portions de la recette). */
  factor?: number;
}

/**
 * Regroupe les ingrédients de plusieurs repas : même nom et même unité → une
 * ligne ; les quantités numériques s'additionnent (proportion des portions
 * comprise), les autres (« 1 pincée ») sont juxtaposées.
 */
export function aggregateIngredients(lines: IngredientLine[]): Array<{ name: string; quantity: string | null }> {
  const groups = new Map<string, { name: string; unit: string | null; sum: number; others: string[] }>();
  for (const line of lines) {
    const name = line.name.trim();
    if (!name) continue;
    const unit = line.unit?.trim() || null;
    const key = `${name.toLowerCase()}|${(unit ?? "").toLowerCase()}`;
    const group = groups.get(key) ?? { name, unit, sum: 0, others: [] };
    const n = parseQuantity(line.quantity);
    if (n !== null) group.sum += n * (line.factor ?? 1);
    else if (line.quantity.trim()) group.others.push(line.quantity.trim());
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .map((g) => {
      const parts = [
        g.sum > 0 ? `${formatQuantity(g.sum)}${g.unit ? ` ${g.unit}` : ""}` : null,
        ...g.others.map((o) => (g.unit ? `${o} ${g.unit}` : o)),
      ].filter(Boolean);
      return { name: g.name, quantity: parts.length ? parts.join(" + ") : null };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
