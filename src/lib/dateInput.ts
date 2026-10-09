import { TIME_ZONE } from "./reminders";

/**
 * Date + heure saisies dans un `<input type="datetime-local">` : le navigateur
 * envoie « 2026-10-09T14:30 », sans fuseau. `new Date()` côté serveur (UTC)
 * les lisait comme de l'heure UTC, donc avec 2 h de retard en été (1 h en
 * hiver) pour un utilisateur à Paris : un rappel « 2 minutes avant » arrivait
 * 2 h trop tard. On les lit donc à l'heure de Paris (`TIME_ZONE`, comme les
 * rappels et le cron). Une chaîne avec fuseau (« …Z », « …+02:00 ») ou sans
 * heure (« 2026-10-09 ») garde le comportement de `new Date()`.
 */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/** Décalage (ms) de `TIME_ZONE` par rapport à UTC à l'instant `at`. */
function zoneOffsetMs(at: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at / 1000) * 1000;
}

export function parseDateTimeInput(value: string): Date {
  const m = LOCAL_DATE_TIME.exec(value.trim());
  if (!m) return new Date(value);
  const [, y, mo, d, h, mi, s] = m;
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  // Deux passes : le décalage doit être celui de l'instant visé, pas de
  // l'instant « mur » lu comme UTC (changement d'heure dans l'intervalle).
  const first = wall - zoneOffsetMs(wall);
  return new Date(wall - zoneOffsetMs(first));
}
