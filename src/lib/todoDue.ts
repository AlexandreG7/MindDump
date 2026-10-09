/**
 * Échéance d'une tâche : conversions entre les champs date/heure du formulaire
 * (heure locale de l'appareil) et l'instant ISO stocké en base. Les options de
 * rappel sont dans reminderOptions.ts.
 */

/** Heure proposée quand on choisit une date sans heure. */
export const DEFAULT_DUE_TIME = "09:00";

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
