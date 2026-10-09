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

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?=$|T)/;

/**
 * Lit une date saisie. Renvoie une date invalide (`isNaN(getTime())`) pour une
 * chaîne illisible ou impossible (31 février, mois 13, 24:00…) au lieu de la
 * décaler silencieusement. Seule exception : l'heure inexistante du passage à
 * l'heure d'été (02:30 le dernier dimanche de mars), acceptée et avancée.
 */
export function parseDateTimeInput(value: string): Date {
  const trimmed = value.trim();
  const prefix = ISO_DATE_PREFIX.exec(trimmed);
  if (prefix) {
    const [, y, mo, d] = prefix;
    const day = new Date(Date.UTC(+y, +mo - 1, +d));
    if (day.getUTCFullYear() !== +y || day.getUTCMonth() !== +mo - 1 || day.getUTCDate() !== +d) {
      return new Date(NaN);
    }
  }

  const m = LOCAL_DATE_TIME.exec(trimmed);
  if (!m) return new Date(trimmed);
  const [, y, mo, d, h, mi, s] = m;
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  // Heure de 24 à 99, minute de 60 à 99… : Date.UTC les reporte au jour suivant.
  const w = new Date(wall);
  if (
    w.getUTCFullYear() !== +y ||
    w.getUTCMonth() !== +mo - 1 ||
    w.getUTCDate() !== +d ||
    w.getUTCHours() !== +h ||
    w.getUTCMinutes() !== +mi ||
    w.getUTCSeconds() !== (s ? +s : 0)
  ) {
    return new Date(NaN);
  }
  // Deux passes : le décalage doit être celui de l'instant visé, pas de
  // l'instant « mur » lu comme UTC (changement d'heure dans l'intervalle).
  const first = wall - zoneOffsetMs(wall);
  const result = wall - zoneOffsetMs(first);

  // Relecture à l'heure de Paris : doit redonner la saisie. Seul écart admis :
  // l'heure sautée au passage à l'heure d'été, relue une heure plus tard (avancée).
  const back = result + zoneOffsetMs(result);
  const gap = back - wall;
  if (gap === 0 || gap === 60 * 60 * 1000) return new Date(result);
  return new Date(NaN);
}

export type ParsedField<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * `dueDate` d'une requête : vide ou null = pas d'échéance ; sinon une date
 * lisible et possible, ou une erreur à renvoyer en 400.
 */
export function readDueDate(raw: unknown): ParsedField<Date | null> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Échéance invalide : date attendue (AAAA-MM-JJThh:mm)." };
  const date = parseDateTimeInput(raw);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Échéance invalide : cette date n'existe pas ou n'est pas lisible (AAAA-MM-JJThh:mm)." };
  }
  return { ok: true, value: date };
}

export const MAX_NOTIFY_BEFORE_MINUTES = 525_600;

/**
 * `notifyBefore` d'une requête : null/absent = pas de rappel ; sinon un entier
 * de minutes entre 0 (à l'heure de l'échéance) et 525 600 (un an).
 */
export function readNotifyBefore(raw: unknown): ParsedField<number | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > MAX_NOTIFY_BEFORE_MINUTES) {
    return {
      ok: false,
      error: `Rappel invalide : un nombre entier de minutes entre 0 et ${MAX_NOTIFY_BEFORE_MINUTES} est attendu (ou null pour aucun rappel).`,
    };
  }
  return { ok: true, value: raw };
}
