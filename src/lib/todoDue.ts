/**
 * Échéance et rappel d'une tâche : options du sélecteur de rappel et
 * conversions entre les champs date/heure du formulaire (heure locale de
 * l'appareil) et l'instant ISO stocké en base.
 */

/** Valeur du sélecteur de rappel pour « Pas de rappel » (notifyBefore = null). */
export const NO_REMINDER = "none";

/**
 * Rappel proposé quand on ajoute une échéance : 15 min avant laisse le temps de
 * finir ce qu'on fait et de s'y mettre ; « à l'heure » arrive trop tard pour
 * s'y préparer, 1 h avant est trop tôt pour une tâche courte et se fait oublier.
 */
export const DEFAULT_REMINDER = "15";

/** Heure proposée quand on choisit une date sans heure. */
export const DEFAULT_DUE_TIME = "09:00";

export const REMINDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: NO_REMINDER, label: "Pas de rappel" },
  { value: "0", label: "À l'heure de l'échéance" },
  { value: "5", label: "5 min avant" },
  { value: "15", label: "15 min avant" },
  { value: "30", label: "30 min avant" },
  { value: "60", label: "1 h avant" },
  { value: "1440", label: "1 jour avant" },
];

/** notifyBefore (minutes, 0 = à l'heure, null = aucun) vers la valeur du sélecteur. */
export function reminderToValue(notifyBefore: number | null | undefined): string {
  return notifyBefore === null || notifyBefore === undefined ? NO_REMINDER : String(notifyBefore);
}

/** Valeur du sélecteur vers notifyBefore : 0 reste 0, seul « Pas de rappel » donne null. */
export function valueToReminder(value: string): number | null {
  if (value === NO_REMINDER || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Libellé d'une valeur de rappel, y compris une valeur hors liste (ex. 45 min saisi par l'API). */
export function reminderLabel(notifyBefore: number | null | undefined): string {
  const value = reminderToValue(notifyBefore);
  const known = REMINDER_OPTIONS.find((o) => o.value === value);
  if (known) return known.label;
  const n = notifyBefore as number;
  if (n % 1440 === 0) return `${n / 1440} jours avant`;
  if (n % 60 === 0) return `${n / 60} h avant`;
  return `${n} min avant`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Instant ISO vers { date: yyyy-MM-dd, time: HH:mm } en heure locale. */
export function splitDue(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Date et heure locales vers un instant ISO (null si pas de date). */
export function joinDue(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || DEFAULT_DUE_TIME}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
