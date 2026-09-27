export type Recurrence = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export const RECURRENCE_OPTIONS: Array<{ value: Recurrence; label: string }> = [
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "biweekly", label: "Toutes les 2 semaines" },
  { value: "monthly", label: "Mensuel" },
  { value: "yearly", label: "Annuel" },
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
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      // Un 29 fevrier retombe au 28 les annees non bissextiles, pas au 1er mars.
      if (next.getMonth() !== date.getMonth()) next.setDate(0);
      return next;
    default:
      return null;
  }
}

const DAY_STEPS: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14 };
const MONTH_STEPS: Record<string, number> = { monthly: 1, yearly: 12 };

/**
 * k-ième occurrence, calculée depuis la date d'origine et non de proche en
 * proche : un 31 janvier mensuel tombe le 28 ou 29 février puis revient au
 * 31 mars, au lieu de glisser au 3 mars puis au 3 de chaque mois.
 */
function nthOccurrence(date: Date, recurrence: string, k: number): Date {
  const next = new Date(date);
  const days = DAY_STEPS[recurrence];
  if (days) {
    next.setDate(next.getDate() + k * days);
    return next;
  }
  next.setDate(1);
  next.setMonth(next.getMonth() + k * MONTH_STEPS[recurrence]);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(date.getDate(), lastDay));
  return next;
}

/**
 * Occurrences d'un événement qui touchent l'intervalle [from, to] : celles qui
 * commencent dedans, et celles commencées avant mais encore en cours (événement
 * sur plusieurs jours). Sans récurrence, l'événement lui-même s'il le touche.
 */
export function occurrencesBetween(
  date: Date,
  endDate: Date | null,
  recurrence: string | null,
  from: Date,
  to: Date
): Array<{ date: Date; endDate: Date | null }> {
  const duration = endDate ? Math.max(0, endDate.getTime() - date.getTime()) : 0;
  const touches = (start: Date) =>
    start <= to && start.getTime() + duration >= from.getTime();

  if (!recurrence || !(recurrence in DAY_STEPS || recurrence in MONTH_STEPS)) {
    return touches(date) ? [{ date, endDate }] : [];
  }

  // Premier rang utile, un peu avant l'intervalle : un événement quotidien
  // ancien ne doit pas épuiser la limite d'itérations avant d'y arriver.
  const lead = new Date(from.getTime() - duration);
  let k: number;
  if (DAY_STEPS[recurrence]) {
    k = Math.floor((lead.getTime() - date.getTime()) / (DAY_STEPS[recurrence] * 86400000)) - 1;
  } else {
    const months = (lead.getFullYear() - date.getFullYear()) * 12 + lead.getMonth() - date.getMonth();
    k = Math.floor(months / MONTH_STEPS[recurrence]) - 1;
  }
  k = Math.max(0, k);

  const result: Array<{ date: Date; endDate: Date | null }> = [];
  for (let guard = 0; guard < 1000; guard++, k++) {
    const current = nthOccurrence(date, recurrence, k);
    if (current > to) break;
    if (touches(current)) {
      result.push({
        date: current,
        endDate: endDate ? new Date(current.getTime() + duration) : null,
      });
    }
  }
  return result;
}

/** RRULE iCalendar correspondante (sans le prefixe "RRULE:"). */
export const RRULE_BY_RECURRENCE: Record<string, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
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
