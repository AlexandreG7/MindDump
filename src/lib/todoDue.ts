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

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/**
 * Date « mur » (yyyy-MM-dd) et heure (HH:mm, avec ou sans secondes) lues à
 * l'heure locale de l'appareil. Construit la date avec ses composantes au lieu
 * d'analyser « 2026-10-09T17:05 » : ce format sans fuseau n'est pas lu pareil
 * par tous les moteurs (ISO 8601 : local ; anciens WebKit : UTC), alors que le
 * constructeur à composantes est local partout. Date invalide si la saisie est
 * illisible ou impossible (31 février, 25:00…), jamais décalée en silence.
 */
export function localDateTime(date: string, time: string): Date {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time || DEFAULT_DUE_TIME);
  if (!d || !t) return new Date(NaN);
  const [y, mo, day] = [+d[1], +d[2], +d[3]];
  const [h, mi, s] = [+t[1], +t[2], t[3] ? +t[3] : 0];
  if (h > 23 || mi > 59 || s > 59) return new Date(NaN);
  const out = new Date(y, mo - 1, day, h, mi, s);
  // 31 février, mois 13… : le constructeur reporte au jour suivant, on refuse.
  // (L'heure sautée au passage à l'heure d'été est reportée d'une heure, acceptée.)
  if (out.getFullYear() !== y || out.getMonth() !== mo - 1 || out.getDate() !== day) return new Date(NaN);
  return out;
}

/** Date et heure locales vers un instant ISO (null si pas de date ou date illisible). */
export function joinDue(date: string, time: string): string | null {
  if (!date) return null;
  const d = localDateTime(date, time);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
