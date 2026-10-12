"use client";

import { useEffect, useRef, useState } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarEvent } from "./types";
import { cn } from "@/lib/utils";
import { timeLabel } from "./EventList";
import { evState, evVars, isAllDayLike, layoutDay, occursOn, spanBars } from "./utils";

const HOUR_PX = 56;
const GUTTER = "2.75rem";
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Grille horaire (vues jour et semaine) : bande des journées entières en haut,
 * événements horaires placés selon leur heure et leur durée.
 */
export function TimeGrid({
  days,
  events,
  selectedDate,
  onSelectDay,
  onCreateAt,
  onOpen,
  selectedId,
}: {
  days: Date[];
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDay: (day: Date) => void;
  onCreateAt: (day: Date, hour: number) => void;
  onOpen: (event: CalendarEvent) => void;
  selectedId?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  // Ouvre la grille vers 7 h plutôt qu'à minuit.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, []);

  // Téléphone : trois jours visibles à la fois (glisser pour les autres), le jour choisi en premier.
  const firstKey = days[0]?.getTime();
  const selKey = selectedDate?.toDateString();
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || days.length < 2 || el.scrollWidth <= el.clientWidth + 1) return;
    const colW = (el.clientWidth - 44) / 3;
    const target = Math.max(0, days.findIndex((d) => (selectedDate ? isSameDay(d, selectedDate) : isToday(d))));
    el.scrollLeft = Math.min(target, days.length - 3) * colW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, selKey, days.length]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const single = days.length === 1;
  const { bars, lanes } = spanBars(days, events.filter(isAllDayLike));
  // Téléphone : colonnes d'un tiers de l'écran ; dès `sm`, toute la semaine tient.
  const cols = { gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0, 1fr))` };
  const minWidth = single ? undefined : `calc(${GUTTER} + (100% - ${GUTTER}) * ${days.length} / 3)`;

  return (
    <div ref={scrollRef} className="max-h-[70vh] overflow-auto overscroll-x-contain rounded-3xl border border-border/60 bg-card [container-type:inline-size]">
      <div className={single ? undefined : "sm:!min-w-0"} style={{ minWidth }}>
        {/* En-têtes et journées entières */}
        <div className="sticky top-0 z-30 border-b border-border/60 bg-card">
          <div className="grid" style={cols}>
            <div className="sticky left-0 z-20 bg-card" />
            {days.map((day) => {
              const selected = selectedDate && isSameDay(day, selectedDate);
              return (
                <div key={day.toISOString()} className="min-w-0 border-l border-border/40 p-1">
                  <button
                    onClick={() => onSelectDay(day)}
                    className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded transition-colors hover:bg-accent ${selected ? "bg-accent" : ""}`}
                  >
                    <span className="text-xs font-medium capitalize text-muted-foreground">
                      {format(day, single ? "EEEE" : "EEE", { locale: fr }).replace(".", "")}
                    </span>
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-medium tabular-nums ${
                        isToday(day) ? "bg-tone-agenda-ink/15 font-bold text-tone-agenda-ink" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          {/* Journées entières et événements sur plusieurs jours : une seule bande continue par événement,
              son titre une fois, collé au bord visible quand la grille défile (téléphone). */}
          {bars.length > 0 && (
            <div className="grid pb-1" style={{ ...cols, gridTemplateRows: `repeat(${lanes}, auto)`, rowGap: 4 }}>
              <div aria-hidden className="sticky left-0 z-20 bg-card" style={{ gridColumn: 1, gridRow: "1 / -1" }} />
              {days.map((day, i) => (
                <div key={day.toISOString()} aria-hidden className="border-l border-border/40" style={{ gridColumn: i + 2, gridRow: "1 / -1" }} />
              ))}
              {bars.map((b) => (
                <button
                  key={b.event.id}
                  onClick={() => onOpen(b.event)}
                  title={b.event.title}
                  className={cn(
                    "ev-chip flex min-h-11 min-w-0 items-center py-1 text-left text-xs leading-snug sm:min-h-7 sm:text-[0.8125rem]",
                    evState(b.event, now, selectedId),
                    b.fromBefore ? "ev-chip-cont rounded-l-none pl-2.5" : "ml-1 rounded-l pl-2.5",
                    b.toAfter ? "rounded-r-none pr-1.5" : "mr-1 rounded-r pr-1.5"
                  )}
                  style={{ ...evVars(b.event), gridColumn: `${b.startCol + 2} / span ${b.span}`, gridRow: b.lane + 1 }}
                >
                  <span
                    className="sticky line-clamp-2 min-w-0 max-w-full break-words"
                    style={{ left: `calc(${GUTTER} + 0.5rem)`, maxWidth: `min(100%, calc(100cqw - ${GUTTER} - 1.25rem))` }}
                  >
                    {b.event.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Heures */}
        <div>
          <div className="grid relative" style={cols}>
            <div className="sticky left-0 z-20 bg-card">
              {HOURS.map((h) => (
                <div key={h} className="relative pr-1.5 text-right text-xs tabular-nums text-muted-foreground/80" style={{ height: HOUR_PX }}>
                  {h > 0 && <span className="absolute -top-2 right-1.5">{`${h}:00`}</span>}
                </div>
              ))}
            </div>
            {days.map((day) => {
              const timed = events.filter((e) => !isAllDayLike(e) && occursOn(e, day));
              const positioned = layoutDay(timed, day);
              const nowTop = isToday(day) ? (now.getHours() * 60 + now.getMinutes()) * (HOUR_PX / 60) : null;
              return (
                <div key={day.toISOString()} className="relative border-l border-border/40">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      aria-label={`Nouvel événement le ${format(day, "d MMMM", { locale: fr })} à ${h} h`}
                      onClick={() => onCreateAt(day, h)}
                      className="block w-full border-b border-border/40 hover:bg-accent/50 transition-colors"
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {positioned.map(({ event, top, height, column, columns }) => {
                    const px = Math.max(height * (HOUR_PX / 60) - 2, 24);
                    const time = timeLabel(event, day);
                    // Heure sous le titre dès 44 px ; un bloc d'une heure (≥ 56 px nominal) laisse deux lignes au titre.
                    const twoLines = !!time && px >= 44;
                    const lines = Math.max(1, Math.floor((px - 6 - (twoLines ? 16 : 0)) / 16));
                    return (
                      <button
                        key={event.id}
                        onClick={() => onOpen(event)}
                        title={`${event.title}${time ? ` ${time}` : ""}`}
                        className={cn("ev-chip absolute overflow-hidden rounded py-[3px] pl-2 pr-1 text-left text-xs leading-4 sm:text-[0.8125rem] sm:leading-4", evState(event, now, selectedId))}
                        style={{
                          top: top * (HOUR_PX / 60),
                          height: px,
                          left: `calc(${(column / columns) * 100}% + 2px)`,
                          width: `calc(${100 / columns}% - 4px)`,
                          ...evVars(event),
                        }}
                      >
                        <span
                          className="block break-words"
                          style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }}
                        >
                          {event.title}
                          {time && !twoLines && <span className="ev-time tabular-nums"> {time.split(" ")[0]}</span>}
                        </span>
                        {twoLines && <span className="ev-time block truncate text-xs leading-4 tabular-nums">{time}</span>}
                      </button>
                    );
                  })}
                  {nowTop !== null && (
                    <div className="absolute left-0 right-0 pointer-events-none" style={{ top: nowTop }}>
                      <div className="h-px bg-destructive" />
                      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-destructive" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
