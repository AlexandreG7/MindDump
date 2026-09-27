import { RRule, RRuleSet } from "rrule";

export interface ICSEvent {
  uid: string;
  title: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  allDay: boolean;
}

/** Fuseau des heures « flottantes » (sans Z ni TZID) : l'app vise des familles en France. */
const DEFAULT_TIME_ZONE = "Europe/Paris";

/** Événement tel que lu dans le fichier, avant développement des récurrences. */
interface ParsedEvent extends ICSEvent {
  rrule: string | null;
  exdates: Date[];
  /** Occurrence d'une série remplacée par cet événement (RECURRENCE-ID). */
  recurrenceId: Date | null;
  /** Fuseau de DTSTART, pour développer la série à heure murale constante. */
  timeZone: string | null;
}

interface WallTime {
  y: number;
  m: number; // 0-11
  d: number;
  h: number;
  min: number;
  s: number;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Décalage (ms) du fuseau à cet instant : heure murale - UTC. */
function zoneOffset(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instant UTC d'une heure murale dans un fuseau (heure d'été comprise). */
export function wallTimeToUtc(w: WallTime, timeZone: string): Date {
  const guess = Date.UTC(w.y, w.m, w.d, w.h, w.min, w.s);
  // Deux passes : le décalage peut changer entre l'estimation et l'instant réel.
  let utc = guess - zoneOffset(new Date(guess), timeZone);
  utc = guess - zoneOffset(new Date(utc), timeZone);
  return new Date(utc);
}

function parseWallTime(value: string): WallTime {
  const clean = value.replace(/[Z\-:]/g, "");
  return {
    y: parseInt(clean.slice(0, 4)),
    m: parseInt(clean.slice(4, 6)) - 1,
    d: parseInt(clean.slice(6, 8)),
    h: parseInt(clean.slice(9, 11)) || 0,
    min: parseInt(clean.slice(11, 13)) || 0,
    s: parseInt(clean.slice(13, 15)) || 0,
  };
}

function timeZoneFromParams(params: string): string | null {
  const match = /TZID=("?)([^;:"]+)\1/i.exec(params);
  if (!match) return null;
  const tz = match[2].trim();
  return isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}

/**
 * Date ICS → instant. Journée entière : minuit UTC, convention de l'app (voir
 * le flux ICS et le MCP). Avec Z : UTC. Avec TZID : dans ce fuseau. Sinon
 * (heure « flottante ») : heure de Paris, jamais le fuseau du serveur.
 */
function parseICSDate(value: string, params: string): { date: Date; allDay: boolean; timeZone: string | null } {
  const allDay = /VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(value.trim());
  const w = parseWallTime(value);
  if (allDay) return { date: new Date(Date.UTC(w.y, w.m, w.d)), allDay: true, timeZone: null };
  if (value.trim().endsWith("Z")) {
    return { date: new Date(Date.UTC(w.y, w.m, w.d, w.h, w.min, w.s)), allDay: false, timeZone: null };
  }
  const timeZone = timeZoneFromParams(params) ?? DEFAULT_TIME_ZONE;
  return { date: wallTimeToUtc(w, timeZone), allDay: false, timeZone };
}

function unfoldLines(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function unescapeICS(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseEvents(icsText: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  let current: Partial<ParsedEvent> | null = null;

  for (const line of unfoldLines(icsText)) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = { exdates: [] };
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current?.title && current.date) {
        events.push({
          uid: current.uid || crypto.randomUUID(),
          title: current.title,
          description: current.description ?? null,
          date: current.date,
          endDate: current.endDate ?? null,
          allDay: current.allDay ?? false,
          rrule: current.rrule ?? null,
          exdates: current.exdates ?? [],
          recurrenceId: current.recurrenceId ?? null,
          timeZone: current.timeZone ?? null,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const baseProp = key.split(";")[0].toUpperCase();
    const params = key.toUpperCase().includes("TZID") ? key : key.toUpperCase();

    switch (baseProp) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.title = unescapeICS(value);
        break;
      case "DESCRIPTION":
        current.description = unescapeICS(value);
        break;
      case "DTSTART": {
        const parsed = parseICSDate(value, params);
        current.date = parsed.date;
        current.allDay = parsed.allDay;
        current.timeZone = parsed.timeZone;
        break;
      }
      case "DTEND": {
        current.endDate = parseICSDate(value, params).date;
        break;
      }
      case "RRULE":
        current.rrule = value;
        break;
      case "EXDATE":
        for (const part of value.split(",")) current.exdates!.push(parseICSDate(part, params).date);
        break;
      case "RECURRENCE-ID":
        current.recurrenceId = parseICSDate(value, params).date;
        break;
    }
  }

  return events;
}

/** Heure murale d'un instant dans un fuseau, codée comme une date UTC (« fausse UTC » de rrule). */
function toFloating(instant: Date, timeZone: string | null): Date {
  if (!timeZone) return instant;
  return new Date(instant.getTime() + zoneOffset(instant, timeZone));
}

function fromFloating(floating: Date, timeZone: string | null): Date {
  if (!timeZone) return floating;
  return wallTimeToUtc(
    {
      y: floating.getUTCFullYear(),
      m: floating.getUTCMonth(),
      d: floating.getUTCDate(),
      h: floating.getUTCHours(),
      min: floating.getUTCMinutes(),
      s: floating.getUTCSeconds(),
    },
    timeZone
  );
}

/** Garde-fou contre un flux qui génèrerait des milliers d'occurrences. */
const MAX_OCCURRENCES_PER_SERIES = 1000;

/**
 * Occurrences qui touchent [from, to]. Une série (RRULE) est développée à
 * heure murale constante dans son fuseau (10 h reste 10 h après le passage à
 * l'heure d'hiver), sans ses EXDATE ni les occurrences remplacées par un
 * RECURRENCE-ID ; les remplaçantes sont des événements à part.
 */
export function expandICSEvents(parsed: ParsedEvent[], from: Date, to: Date): ICSEvent[] {
  const overridden = new Map<string, Set<number>>();
  for (const e of parsed) {
    if (!e.recurrenceId) continue;
    if (!overridden.has(e.uid)) overridden.set(e.uid, new Set());
    overridden.get(e.uid)!.add(e.recurrenceId.getTime());
  }

  const result: ICSEvent[] = [];
  const touches = (start: Date, end: Date | null) =>
    start <= to && (end && end > start ? end : start) >= from;

  for (const e of parsed) {
    const duration = e.endDate ? Math.max(0, e.endDate.getTime() - e.date.getTime()) : 0;

    if (!e.rrule || e.recurrenceId) {
      if (touches(e.date, e.endDate)) {
        result.push({
          uid: e.recurrenceId ? `${e.uid}_${e.recurrenceId.toISOString()}` : e.uid,
          title: e.title,
          description: e.description,
          date: e.date,
          endDate: e.endDate,
          allDay: e.allDay,
        });
      }
      continue;
    }

    let rule: RRule;
    try {
      const options = RRule.parseString(e.rrule);
      // UNTIL est en UTC (RFC 5545) : on le ramène dans le repère « heure murale » de la série.
      if (options.until && e.timeZone) options.until = toFloating(options.until, e.timeZone);
      rule = new RRule({ ...options, dtstart: toFloating(e.date, e.timeZone) });
    } catch {
      if (touches(e.date, e.endDate)) result.push({ ...e, uid: e.uid });
      continue;
    }

    const set = new RRuleSet();
    set.rrule(rule);
    for (const ex of e.exdates) set.exdate(toFloating(ex, e.timeZone));

    const skip = overridden.get(e.uid);
    const windowStart = toFloating(new Date(from.getTime() - duration), e.timeZone);
    const windowEnd = toFloating(to, e.timeZone);
    let count = 0;
    set.between(windowStart, windowEnd, true, (floating) => {
      if (++count > MAX_OCCURRENCES_PER_SERIES) return false;
      const start = e.allDay ? floating : fromFloating(floating, e.timeZone);
      if (skip?.has(start.getTime())) return true;
      const end = e.endDate ? new Date(start.getTime() + duration) : null;
      if (touches(start, end)) {
        result.push({
          uid: `${e.uid}_${start.toISOString()}`,
          title: e.title,
          description: e.description,
          date: start,
          endDate: end,
          allDay: e.allDay,
        });
      }
      return true;
    });
  }

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Tous les événements du fichier (séries développées sur l'intervalle, un an autour d'aujourd'hui par défaut). */
export function parseICS(icsText: string, from?: Date, to?: Date): ICSEvent[] {
  const now = Date.now();
  return expandICSEvents(
    parseEvents(icsText),
    from ?? new Date(now - 31 * 86400000),
    to ?? new Date(now + 365 * 86400000)
  );
}

export async function fetchICSEvents(url: string, from?: Date, to?: Date): Promise<ICSEvent[]> {
  const fetchUrl = url.replace(/^webcal:\/\//, "https://");
  const res = await fetch(fetchUrl, {
    headers: { "User-Agent": "MindDump/1.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Failed to fetch ICS: ${res.status}`);
  const text = await res.text();
  return parseICS(text, from, to);
}
