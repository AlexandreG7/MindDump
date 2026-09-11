export type Recurrence = "daily" | "weekly" | "biweekly" | "monthly";

export const RECURRENCE_OPTIONS: Array<{ value: Recurrence; label: string }> = [
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "biweekly", label: "Toutes les 2 semaines" },
  { value: "monthly", label: "Mensuel" },
];

export const RECURRENCE_LABELS: Record<string, string> = Object.fromEntries(
  RECURRENCE_OPTIONS.map((o) => [o.value, o.label])
);

export function isRecurrence(value: unknown): value is Recurrence {
  return (
    typeof value === "string" &&
    RECURRENCE_OPTIONS.some((o) => o.value === value)
  );
}

/** Renvoie la date de l'occurrence suivante, ou null si la recurrence est inconnue. */
export function nextOccurrence(date: Date, recurrence: string): Date | null {
  const next = new Date(date);
  switch (recurrence) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      return next;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      return next;
    default:
      return null;
  }
}

/** RRULE iCalendar correspondante (sans le prefixe "RRULE:"). */
export const RRULE_BY_RECURRENCE: Record<string, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
};

/** Palette proposee pour colorer les evenements du calendrier. */
export const EVENT_COLORS: Array<{ value: string; label: string }> = [
  { value: "#3b82f6", label: "Bleu" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Rose" },
  { value: "#ef4444", label: "Rouge" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Jaune" },
  { value: "#22c55e", label: "Vert" },
  { value: "#14b8a6", label: "Turquoise" },
  { value: "#64748b", label: "Gris" },
];

export function isEventColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
