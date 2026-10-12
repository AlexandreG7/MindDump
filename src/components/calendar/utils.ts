import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarEvent, ViewMode } from "./types";
import { textOn } from "@/components/profiles/ProfileAvatar";

const WEEK = { weekStartsOn: 1 as const };

/** Jours couverts par la liste. */
export const AGENDA_DAYS = 30;

/** Durée affichée d'un événement horaire sans heure de fin. */
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

/** Intervalle à charger pour une vue (grille du mois complète, semaines débordantes comprises). */
export function rangeForView(view: ViewMode, anchor: Date): { from: Date; to: Date } {
  switch (view) {
    case "day":
      return { from: startOfDay(anchor), to: endOfDay(anchor) };
    case "week":
      return { from: startOfWeek(anchor, WEEK), to: endOfWeek(anchor, WEEK) };
    case "month":
      return {
        from: startOfWeek(startOfMonth(anchor), WEEK),
        to: endOfWeek(endOfMonth(anchor), WEEK),
      };
    case "agenda":
      return { from: startOfDay(anchor), to: endOfDay(addDays(anchor, AGENDA_DAYS - 1)) };
    case "year":
      return { from: startOfYear(anchor), to: endOfYear(anchor) };
  }
}

/** Date de référence après un clic sur précédent (-1) ou suivant (+1). */
export function shiftAnchor(view: ViewMode, anchor: Date, direction: 1 | -1): Date {
  switch (view) {
    case "day":
      return addDays(anchor, direction);
    case "week":
      return addWeeks(anchor, direction);
    case "month":
      return addMonths(anchor, direction);
    case "agenda":
      return addDays(anchor, direction * AGENDA_DAYS);
    case "year":
      return addYears(anchor, direction);
  }
}

export function titleForView(view: ViewMode, anchor: Date): string {
  switch (view) {
    case "day":
      return format(anchor, "EEEE d MMMM yyyy", { locale: fr });
    case "week": {
      const from = startOfWeek(anchor, WEEK);
      const to = endOfWeek(anchor, WEEK);
      return from.getMonth() === to.getMonth()
        ? `${format(from, "d")} – ${format(to, "d MMMM yyyy", { locale: fr })}`
        : `${format(from, "d MMM", { locale: fr })} – ${format(to, "d MMM yyyy", { locale: fr })}`;
    }
    case "month":
      return format(anchor, "MMMM yyyy", { locale: fr });
    case "agenda": {
      const to = addDays(anchor, AGENDA_DAYS - 1);
      return `${format(anchor, "d MMM", { locale: fr })} – ${format(to, "d MMM yyyy", { locale: fr })}`;
    }
    case "year":
      return anchor.getFullYear().toString();
  }
}

/** Ce dont ont besoin les calculs de jours : aussi utilisé par l'écran mural. */
export type Timed = Pick<CalendarEvent, "date" | "endDate" | "allDay">;

export function eventStart(e: Timed): Date {
  return new Date(e.date);
}

/** Fin affichée : heure de fin, sinon fin de journée (journée entière) ou +1 h. */
export function eventEnd(e: Timed): Date {
  if (e.endDate) {
    const end = new Date(e.endDate);
    if (end > eventStart(e)) return end;
  }
  return e.allDay ? endOfDay(eventStart(e)) : new Date(eventStart(e).getTime() + DEFAULT_DURATION_MS);
}

/** Jour calendaire d'une date de journée entière (minuit UTC par convention). */
function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** L'événement touche-t-il ce jour (y compris un événement sur plusieurs jours) ? */
export function occursOn(e: Timed, day: Date): boolean {
  if (e.allDay) {
    // Journée entière : dates au sens du calendrier, fin exclusive (norme ICS),
    // quel que soit le fuseau du navigateur.
    const start = eventStart(e);
    const end = e.endDate ? new Date(e.endDate) : null;
    const last = end && end > start ? new Date(end.getTime() - 1) : start;
    const key = localDayKey(day);
    return key >= utcDayKey(start) && key <= utcDayKey(last);
  }
  const start = eventStart(e);
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  if (start > dayEnd) return false;
  // Une fin pile à minuit n'empiète pas sur le jour suivant.
  return start >= dayStart || eventEnd(e) > dayStart;
}

/**
 * Premier et dernier jour d'un événement (yyyy-MM-dd). Journée entière : jours
 * calendaires (fin exclusive) ; horaire : jours locaux.
 */
export function eventDays(e: Timed): { first: string; last: string } {
  if (e.allDay) {
    const start = eventStart(e);
    const end = e.endDate ? new Date(e.endDate) : null;
    return { first: utcDayKey(start), last: utcDayKey(end && end > start ? new Date(end.getTime() - 1) : start) };
  }
  return { first: localDayKey(eventStart(e)), last: localDayKey(new Date(eventEnd(e).getTime() - 1)) };
}

/** Clé yyyy-MM-dd d'un jour local (celle qu'attend `eventDays`). */
export const dayKey = localDayKey;

/**
 * Place d'un jour dans un événement qui en couvre plusieurs : rang (1 pour le
 * premier jour), nombre de jours, dernier jour. null pour un événement d'un jour.
 */
export function daySpan(e: Timed, day: Date): { index: number; total: number; lastDay: Date } | null {
  const toUtc = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  const { first, last } = eventDays(e);
  const total = Math.round((toUtc(last) - toUtc(first)) / 86400000) + 1;
  if (total < 2) return null;
  const index = Math.round((toUtc(localDayKey(day)) - toUtc(first)) / 86400000) + 1;
  const lastDay = new Date(+last.slice(0, 4), +last.slice(5, 7) - 1, +last.slice(8, 10));
  return { index, total, lastDay };
}

/** Sur plusieurs jours, ou journée entière : affiché dans la bande du haut de la grille horaire. */
export function isAllDayLike(e: Timed): boolean {
  if (e.allDay) return true;
  return startOfDay(eventStart(e)).getTime() !== startOfDay(new Date(eventEnd(e).getTime() - 1)).getTime();
}

export function sortEvents<T extends Timed>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return eventStart(a).getTime() - eventStart(b).getTime();
  });
}

export interface PositionedEvent {
  event: CalendarEvent;
  top: number; // minutes depuis minuit
  height: number; // minutes
  column: number;
  columns: number;
}

/**
 * Place les événements horaires d'un jour : ceux qui se chevauchent se
 * partagent la largeur, chaque groupe de chevauchement ayant ses propres colonnes.
 */
export function layoutDay(events: CalendarEvent[], day: Date): PositionedEvent[] {
  const dayStart = startOfDay(day).getTime();
  const items = events
    .map((event) => {
      const start = Math.max(eventStart(event).getTime(), dayStart);
      const end = Math.min(eventEnd(event).getTime(), dayStart + 24 * 3600000);
      const top = (start - dayStart) / 60000;
      return { event, top, height: Math.max(20, (end - start) / 60000) };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const result: PositionedEvent[] = [];
  let cluster: Array<(typeof items)[number] & { column: number }> = [];
  let clusterEnd = -1;

  const flush = () => {
    const columns = Math.max(1, ...cluster.map((c) => c.column + 1));
    for (const c of cluster) result.push({ event: c.event, top: c.top, height: c.height, column: c.column, columns });
    cluster = [];
  };

  for (const item of items) {
    if (item.top >= clusterEnd && cluster.length > 0) flush();
    const taken = new Set(cluster.filter((c) => c.top + c.height > item.top).map((c) => c.column));
    let column = 0;
    while (taken.has(column)) column++;
    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, item.top + item.height);
  }
  if (cluster.length > 0) flush();
  return result;
}

/** Couleur d'un événement (celle par défaut suit le thème). */
export function eventStyle(e: CalendarEvent, solid = false): React.CSSProperties | undefined {
  const color = e.displayColor ?? e.color;
  if (!color) return undefined;
  return solid
    ? { backgroundColor: color, color: textOn(color) }
    : { backgroundColor: `${color}20`, color };
}

/** Couleur de l'événement pour `.ev-chip` (liseré, points) ; sans couleur, l'encre du module. */
export function evVars(e: CalendarEvent): React.CSSProperties {
  const color = e.displayColor ?? e.color;
  return (color ? { "--ev": color } : {}) as React.CSSProperties;
}

/** Heure de début affichée en préfixe (« 17:30 »), rien pour une journée entière ou un événement sur plusieurs jours. */
export function startTimePrefix(e: CalendarEvent): string | null {
  const start = eventStart(e);
  return e.allDay || isAllDayLike(e) ? null : format(start, "HH:mm");
}

/** Sans couleur propre ni personne : couleur par défaut du thème. */
export function hasColor(e: CalendarEvent): boolean {
  return !!(e.displayColor ?? e.color);
}

/** Jour calendaire (minuit local) d'une clé yyyy-MM-dd. */
export function keyToDate(k: string): Date {
  return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
}

/** Période d'un événement en toutes lettres : « lundi 12 octobre » ou « du jeudi 15 au dimanche 18 octobre ». */
export function formatEventRange(e: Timed): string {
  const { first, last } = eventDays(e);
  const a = keyToDate(first);
  if (first === last) return format(a, "EEEE d MMMM", { locale: fr });
  const b = keyToDate(last);
  return a.getMonth() === b.getMonth()
    ? `du ${format(a, "EEEE d", { locale: fr })} au ${format(b, "EEEE d MMMM", { locale: fr })}`
    : `du ${format(a, "EEE d MMM", { locale: fr })} au ${format(b, "EEE d MMM", { locale: fr })}`;
}

/** Nombre de jours couverts (1 pour un événement d'un jour). */
export function daysCovered(e: Timed): number {
  const { first, last } = eventDays(e);
  const a = keyToDate(first);
  const b = keyToDate(last);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000) + 1;
}

/** Vrai si l'événement est un horaire déjà terminé (pour atténuer la ligne du jour). */
export function isFinished(e: Timed, now: Date): boolean {
  return !e.allDay && eventEnd(e) <= now;
}

/** Événement entièrement passé (journée entière : dernier jour avant aujourd'hui). */
export function isPast(e: Timed, now: Date): boolean {
  if (e.allDay) return eventDays(e).last < dayKey(now);
  return eventEnd(e) <= now;
}

/** Classes d'état de `.ev-chip` : atténué si passé, aplat si ouvert dans la fiche. */
export function evState(e: CalendarEvent, now: Date, selectedId?: string | null): string {
  if (selectedId && e.id === selectedId) return "ev-sel";
  return isPast(e, now) ? "ev-past" : "";
}
