"use client";

import { addDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./types";
import { dayKey, eventDays, eventStart, evVars, occursOn, startTimePrefix } from "./utils";

const WEEK = { weekStartsOn: 1 as const };

export function monthDays(month: Date): Date[] {
  const days: Date[] = [];
  const end = endOfWeek(endOfMonth(month), WEEK);
  for (let d = startOfWeek(startOfMonth(month), WEEK); d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

const MAX_LANES = 3; // bandes multi-jours visibles (2 sur téléphone)
const MAX_CHIPS = 3; // puces d'un jour sur ordinateur
const MAX_DOTS = 3; // points d'un jour sur téléphone

interface Bar {
  event: CalendarEvent;
  startCol: number;
  span: number;
  lane: number;
  fromBefore: boolean;
  toAfter: boolean;
}

const isMulti = (e: CalendarEvent) => {
  const d = eventDays(e);
  return d.first !== d.last;
};

/** Bandes des événements sur plusieurs jours pour une semaine, rangées en lignes sans chevauchement. */
function weekBars(week: Date[], events: CalendarEvent[]): { bars: Bar[]; lanes: number } {
  const keys = week.map(dayKey);
  const bars: Bar[] = [];
  const laneEnds: number[] = [];
  const multi = events
    .map((event) => ({ event, ...eventDays(event) }))
    .filter((m) => m.first !== m.last && m.last >= keys[0] && m.first <= keys[6])
    .sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
  for (const m of multi) {
    const startCol = m.first < keys[0] ? 0 : keys.indexOf(m.first);
    const endCol = m.last > keys[6] ? 6 : keys.indexOf(m.last);
    let lane = laneEnds.findIndex((end) => end < startCol);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endCol;
    bars.push({ event: m.event, startCol, span: endCol - startCol + 1, lane, fromBefore: m.first < keys[0], toAfter: m.last > keys[6] });
  }
  return { bars, lanes: laneEnds.length };
}

/**
 * Mois en grille, lisible d'abord. Ordinateur : chaque événement est une puce
 * (heure en préfixe, titre sur deux lignes, texte foncé sur fond teinté) ;
 * un événement sur plusieurs jours est une bande qui traverse la semaine, son
 * titre répété en début de semaine. Téléphone : bandes multi-jours avec titre
 * et points pour les autres ; le détail du jour choisi s'affiche sous la grille.
 */
export function MonthGrid({
  month,
  events,
  selectedDate,
  onSelectDay,
}: {
  month: Date;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDay: (day: Date) => void;
}) {
  const all = monthDays(month);
  const weeks = Array.from({ length: all.length / 7 }, (_, i) => all.slice(i * 7, i * 7 + 7));

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
      <div className="grid grid-cols-7 bg-tone-agenda-soft">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-extrabold uppercase tracking-wide text-tone-agenda-ink">
            {d}
          </div>
        ))}
      </div>
      <div className="space-y-px bg-border/70">
        {weeks.map((week) => {
          const weekEvents = events.filter((e) => week.some((d) => occursOn(e, d)));
          const { bars, lanes } = weekBars(week, weekEvents);
          const rowVars = { "--lm": Math.min(lanes, 2), "--ld": Math.min(lanes, MAX_LANES) } as React.CSSProperties;
          return (
            <div key={week[0].toISOString()} className="relative" style={rowVars}>
              <div className="grid grid-cols-7 gap-px bg-border/70">
                {week.map((d, col) => {
                  const dayEvents = weekEvents.filter((e) => occursOn(e, d));
                  const singles = dayEvents.filter((e) => !isMulti(e)).sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime());
                  const multis = bars.filter((b) => b.startCol <= col && b.startCol + b.span > col);
                  const hiddenBarsD = multis.filter((b) => b.lane >= MAX_LANES).length;
                  const hiddenBarsM = multis.filter((b) => b.lane >= 2).length;
                  const moreD = Math.max(0, singles.length - MAX_CHIPS) + hiddenBarsD;
                  const moreM = Math.max(0, singles.length - MAX_DOTS) + hiddenBarsM;
                  const isSelected = !!selectedDate && isSameDay(d, selectedDate);
                  const today = isToday(d);
                  const inMonth = isSameMonth(d, month);
                  const titles = [...multis.map((b) => b.event), ...singles].map((e) => e.title);
                  return (
                    <button
                      type="button"
                      key={d.toISOString()}
                      onClick={() => onSelectDay(d)}
                      aria-pressed={isSelected}
                      aria-label={`${format(d, "EEEE d MMMM", { locale: fr })}, ${
                        dayEvents.length === 0
                          ? "rien de prévu"
                          : `${dayEvents.length} événement${dayEvents.length > 1 ? "s" : ""} : ${titles.join(", ")}`
                      }`}
                      className={cn(
                        "flex min-h-[4.75rem] min-w-0 flex-col items-stretch gap-1 bg-card px-1 pb-1.5 pt-1.5 text-left transition-colors duration-150 hover:bg-secondary/60 sm:min-h-[7.5rem] sm:px-1.5",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        !inMonth && "bg-muted/50",
                        isSelected && "bg-tone-agenda-soft hover:bg-tone-agenda-soft"
                      )}
                    >
                      <span
                        className={cn(
                          "font-display grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.9375rem] leading-none tabular-nums",
                          !inMonth && "text-muted-foreground",
                          today && "bg-tone-agenda text-on-tone",
                          !today && isSelected && "bg-tone-agenda-ink text-tone-agenda-soft"
                        )}
                      >
                        {format(d, "d")}
                      </span>
                      {/* Place réservée aux bandes multi-jours (dessinées au-dessus, sur la semaine) */}
                      <span aria-hidden className="block h-[calc(var(--lm)*1.5rem)] shrink-0 sm:h-[calc(var(--ld)*1.5rem)]" />
                      <span aria-hidden className="hidden flex-col gap-1 sm:flex">
                        {singles.slice(0, MAX_CHIPS).map((e) => {
                          const time = startTimePrefix(e);
                          return (
                            <span
                              key={e.id}
                              title={`${time ? `${time} ` : ""}${e.title}`}
                              className="ev-chip line-clamp-2 break-words rounded-md py-0.5 pl-2 pr-1 text-[0.8125rem] leading-[1.15rem]"
                              style={evVars(e)}
                            >
                              {time && <span className="font-extrabold tabular-nums">{time} </span>}
                              {e.title}
                            </span>
                          );
                        })}
                        {moreD > 0 && <span className="px-1 text-[0.8125rem] font-bold leading-none text-muted-foreground">+{moreD} autre{moreD > 1 ? "s" : ""}</span>}
                      </span>
                      <span aria-hidden className="flex flex-wrap items-center gap-1 px-0.5 sm:hidden">
                        {singles.slice(0, MAX_DOTS).map((e) => (
                          <span key={e.id} className="ev-chip h-2.5 w-2.5 rounded-full !shadow-none ring-1 ring-foreground/20" style={{ ...evVars(e), backgroundColor: "var(--ev-base)" }} />
                        ))}
                        {moreM > 0 && <span className="text-xs font-bold leading-none text-muted-foreground">+{moreM}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Bandes multi-jours : une ligne par bande, titre en début de semaine */}
              {bars.length > 0 && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-[2.375rem] grid grid-cols-7 gap-x-px gap-y-0.5 [grid-auto-rows:1.375rem]"
                >
                  {bars.map((b) => (
                    <span
                      key={b.event.id}
                      title={b.event.title}
                      className={cn(
                        "ev-chip flex items-center overflow-hidden text-xs leading-none sm:text-[0.8125rem]",
                        b.fromBefore ? "ev-chip-cont rounded-l-none pl-2" : "ml-1 rounded-l-md pl-2 sm:ml-1.5",
                        b.toAfter ? "rounded-r-none" : "mr-1 rounded-r-md sm:mr-1.5",
                        b.lane >= 2 && "max-sm:hidden",
                        b.lane >= MAX_LANES && "hidden"
                      )}
                      style={{ ...evVars(b.event), gridColumn: `${b.startCol + 1} / span ${b.span}`, gridRow: b.lane + 1 }}
                    >
                      <span className="truncate font-bold">{b.event.title}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearGrid({
  year,
  events,
  onSelectMonth,
}: {
  year: number;
  events: CalendarEvent[];
  onSelectMonth: (month: Date) => void;
}) {
  const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {months.map((month) => (
        <button
          type="button"
          key={month.toISOString()}
          className="rounded-3xl border border-border/70 bg-card p-3.5 text-left transition-[transform,border-color] duration-150 hover:border-tone-agenda active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelectMonth(month)}
          aria-label={`Ouvrir ${month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`}
        >
          <p className="font-display mb-2 text-base capitalize">
            {month.toLocaleDateString("fr-FR", { month: "long" })}
          </p>
          <div className="grid grid-cols-7 gap-px">
            {["L", "M", "M", "J", "V", "S", "D"].map((dl, i) => (
              <div key={i} className="text-center text-[9px] text-muted-foreground font-medium">
                {dl}
              </div>
            ))}
            {monthDays(month).map((dd) => {
              const inMonth = isSameMonth(dd, month);
              const hasEvents = inMonth && events.some((e) => occursOn(e, dd));
              return (
                <div
                  key={dd.toISOString()}
                  className={`text-center text-[10px] py-0.5 relative ${!inMonth ? "text-transparent" : ""} ${
                    isToday(dd) ? "font-extrabold text-tone-agenda-ink" : ""
                  }`}
                >
                  {format(dd, "d")}
                  {hasEvents && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-tone-agenda-ink" />
                  )}
                </div>
              );
            })}
          </div>
        </button>
      ))}
    </div>
  );
}
