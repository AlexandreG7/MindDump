/**
 * Rappels : options fixes du menu (tâches et agenda), et règles qui disent
 * quelles options ont encore un sens selon l'heure de l'échéance.
 * Pas de saisie libre : le seul moyen de choisir un rappel est ce menu.
 */

/** Valeur du menu pour « Pas de rappel » (notifyBefore = null). */
export const NO_REMINDER = "none";

/**
 * Rappel proposé quand on ajoute une échéance : 15 min avant laisse le temps de
 * finir ce qu'on fait et de s'y mettre ; « à l'heure » arrive trop tard pour
 * s'y préparer, 1 h avant est trop tôt pour une tâche courte et se fait oublier.
 */
export const DEFAULT_REMINDER = "15";

export interface ReminderOption {
  value: string;
  label: string;
  /** Forme courte pour les phrases d'aide (« Le rappel de 15 min… »). */
  short: string;
  /** Délai en minutes avant l'échéance (null pour « Pas de rappel »). */
  minutes: number | null;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: NO_REMINDER, label: "Pas de rappel", short: "", minutes: null },
  { value: "0", label: "À l'heure de l'échéance", short: "à l'heure", minutes: 0 },
  { value: "5", label: "5 min avant", short: "5 min", minutes: 5 },
  { value: "15", label: "15 min avant", short: "15 min", minutes: 15 },
  { value: "30", label: "30 min avant", short: "30 min", minutes: 30 },
  { value: "60", label: "1 h avant", short: "1 h", minutes: 60 },
  { value: "1440", label: "1 jour avant", short: "1 jour", minutes: 1440 },
];

/** Un rappel qui part dans moins d'une minute est considéré comme déjà passé. */
export const MIN_LEAD_MS = 60 * 1000;

/** notifyBefore (minutes, 0 = à l'heure, null = aucun) vers la valeur du menu. */
export function reminderToValue(notifyBefore: number | null | undefined): string {
  return notifyBefore === null || notifyBefore === undefined ? NO_REMINDER : String(notifyBefore);
}

/** Valeur du menu vers notifyBefore : 0 reste 0, seul « Pas de rappel » donne null. */
export function valueToReminder(value: string): number | null {
  if (value === NO_REMINDER || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Libellé d'une valeur de rappel, y compris une valeur hors menu (ancienne saisie libre). */
export function reminderLabel(notifyBefore: number | null | undefined): string {
  const value = reminderToValue(notifyBefore);
  const known = REMINDER_OPTIONS.find((o) => o.value === value);
  if (known) return known.label;
  const n = notifyBefore as number;
  if (n % 1440 === 0) return `${n / 1440} jour${n / 1440 > 1 ? "s" : ""} avant`;
  if (n % 60 === 0) return `${n / 60} h avant`;
  return `${n} min avant`;
}

/** Forme courte d'une valeur de rappel (« 15 min », « 2 h »…). */
export function reminderShort(value: string): string {
  const known = REMINDER_OPTIONS.find((o) => o.value === value);
  if (known) return known.short;
  return reminderLabel(valueToReminder(value)).replace(/ avant$/, "");
}

/** Instant (ms) où partirait le rappel, ou null s'il n'y en a pas. */
export function reminderFireAt(dueIso: string | null | undefined, value: string): number | null {
  const minutes = valueToReminder(value);
  if (!dueIso || minutes === null) return null;
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return null;
  return due - minutes * 60 * 1000;
}

/** Vrai si ce rappel est déjà passé, ou part dans moins d'une minute. */
export function isReminderPast(dueIso: string | null | undefined, value: string, now: number): boolean {
  const fireAt = reminderFireAt(dueIso, value);
  return fireAt !== null && fireAt - now < MIN_LEAD_MS;
}

/**
 * Rappel à retenir pour une échéance donnée quand on voudrait `wanted` :
 * `wanted` s'il est encore possible, sinon l'option valide la plus longue
 * (« À l'heure » au pire), ou « Pas de rappel » si l'échéance elle-même est
 * passée. Aucune valeur n'est inventée : on ne change que vers une option du menu.
 */
export function settleReminder(dueIso: string | null | undefined, wanted: string, now: number): string {
  if (!dueIso || wanted === NO_REMINDER || !isReminderPast(dueIso, wanted, now)) return wanted;
  const valid = REMINDER_OPTIONS.filter((o) => o.minutes !== null && !isReminderPast(dueIso, o.value, now));
  if (valid.length === 0) return NO_REMINDER;
  return valid.reduce((best, o) => (o.minutes! > best.minutes! ? o : best)).value;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Heure à la française : « 10 h 05 ». */
export function formatClock(d: Date): string {
  return `${d.getHours()} h ${pad(d.getMinutes())}`;
}

/** « 10 h 05 » aujourd'hui, « demain à 10 h 05 », sinon « le mar. 14 oct. à 10 h 05 ». */
export function formatFireAt(ms: number, now: number): string {
  const d = new Date(ms);
  const today = new Date(now);
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(d) - dayStart(today)) / 86_400_000);
  if (diffDays === 0) return `à ${formatClock(d)}`;
  if (diffDays === 1) return `demain à ${formatClock(d)}`;
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return `le ${day} à ${formatClock(d)}`;
}
