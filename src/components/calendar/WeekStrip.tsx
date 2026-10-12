"use client";

import { addDays, format, isToday, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./types";
import { dayKey, eventDays, evState, evVars, occursOn } from "./utils";

const MAX_LANES = 3;

interface Bar {
  event: CalendarEvent;
  startCol: number;
  span: number;
  lane: number;
  fromBefore: boolean;
  toAfter: boolean;
}

/**
 * Les sept jours de la semaine en cours, d'un coup d'œil : un point par
 * événement d'un jour, une barre continue pour ceux qui en couvrent plusieurs.
 * Un appui sur un jour ouvre ce jour ; la liste dessous donne le détail.
 */
export function WeekStrip({
  events,
  onSelectDay,
  selectedId,
}: {
  events: CalendarEvent[];
  onSelectDay: (day: Date) => void;
  selectedId?: string | null;
}) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i));
  const keys = days.map(dayKey);

  const bars: Bar[] = [];
  const laneEnds: number[] = [];
  const multi = events
    .map((event) => ({ event, ...eventDays(event) }))
    .filter((m) => m.first !== m.last && m.last >= keys[0] && m.first <= keys[6])
    .sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : a.last < b.last ? 1 : -1));
  for (const m of multi) {
    const startCol = Math.max(0, keys.indexOf(m.first));
    const endCol = m.last >= keys[6] ? 6 : keys.indexOf(m.last);
    let lane = laneEnds.findIndex((end) => end < startCol);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endCol;
    bars.push({ event: m.event, startCol, span: endCol - startCol + 1, lane, fromBefore: m.first < keys[0], toAfter: m.last > keys[6] });
  }
  const shown = bars.filter((b) => b.lane < MAX_LANES);

  return (
    <section aria-label="Cette semaine" className="rounded-[1.75rem] border border-border/60 bg-card p-2.5">
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const today = isToday(day);
          const dayEvents = events.filter((e) => occursOn(e, day));
          const single = dayEvents.filter((e) => {
            const d = eventDays(e);
            return d.first === d.last;
          });
          const label = `${format(day, "EEEE d MMMM", { locale: fr })}, ${
            dayEvents.length === 0 ? "rien de prévu" : `${dayEvents.length} événement${dayEvents.length > 1 ? "s" : ""}`
          }`;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-label={label}
              className="flex min-h-[4.5rem] flex-col items-center gap-1 rounded-2xl py-1.5 transition-[transform,background-color] duration-150 hover:bg-secondary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("text-[0.6875rem] font-extrabold uppercase leading-none tracking-wide", today ? "text-tone-agenda-ink" : "text-muted-foreground")}>
                {format(day, "EEEEE", { locale: fr })}
              </span>
              <span
                className={cn(
                  "font-display grid h-9 w-9 place-items-center rounded-full text-lg leading-none tabular-nums",
                  today && "bg-tone-agenda text-on-tone"
                )}
              >
                {format(day, "d")}
              </span>
              <span aria-hidden className="flex h-2 items-center gap-0.5">
                {single.slice(0, 3).map((e) => {
                  const c = e.displayColor ?? e.color;
                  return (
                    <span
                      key={e.id}
                      className={cn("h-1.5 w-1.5 rounded-full", !c && "bg-tone-agenda-ink")}
                      style={c ? { backgroundColor: c } : undefined}
                    />
                  );
                })}
                {single.length > 3 && <span className="text-[0.625rem] font-bold leading-none text-muted-foreground">+{single.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {shown.length > 0 && (
        <div aria-hidden className="mt-1 grid grid-cols-7 gap-x-1 gap-y-1">
          {shown.map((b) => (
            <span
              key={b.event.id}
              className={cn(
                "ev-chip flex min-h-7 items-center py-1 pl-2.5 pr-2 text-xs leading-4",
                evState(b.event, now, selectedId),
                b.fromBefore ? "ev-chip-cont rounded-l-none" : "rounded-l",
                b.toAfter ? "rounded-r-none" : "rounded-r"
              )}
              style={{ ...evVars(b.event), gridColumn: `${b.startCol + 1} / span ${b.span}`, gridRow: b.lane + 1 }}
            >
              <span className="line-clamp-2 break-words">{b.event.title}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
