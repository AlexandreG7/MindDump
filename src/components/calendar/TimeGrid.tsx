"use client";

import { useEffect, useRef, useState } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarEvent } from "./types";
import { evVars, isAllDayLike, layoutDay, occursOn, startTimePrefix } from "./utils";

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
}: {
  days: Date[];
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDay: (day: Date) => void;
  onCreateAt: (day: Date, hour: number) => void;
  onOpen: (event: CalendarEvent) => void;
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
  // Téléphone : colonnes d'un tiers de l'écran ; dès `sm`, toute la semaine tient.
  const cols = { gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0, 1fr))` };
  const minWidth = single ? undefined : `calc(${GUTTER} + (100% - ${GUTTER}) * ${days.length} / 3)`;

  return (
    <div ref={scrollRef} className="max-h-[70vh] overflow-auto overscroll-x-contain rounded-3xl border border-border/70 bg-card">
      <div className={single ? undefined : "sm:!min-w-0"} style={{ minWidth }}>
        {/* En-têtes et journées entières */}
        <div className="sticky top-0 z-30 grid border-b border-border bg-muted" style={cols}>
          <div className="sticky left-0 z-20 bg-muted" />
          {days.map((day) => {
            const allDay = events.filter((e) => isAllDayLike(e) && occursOn(e, day));
            const selected = selectedDate && isSameDay(day, selectedDate);
            return (
              <div key={day.toISOString()} className="border-l border-border p-1 min-w-0">
                <button
                  onClick={() => onSelectDay(day)}
                  className={`flex min-h-11 w-full flex-col items-center justify-center rounded-md py-1 transition-colors hover:bg-accent ${selected ? "bg-accent" : ""}`}
                >
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    {format(day, single ? "EEEE" : "EEE", { locale: fr })}
                  </span>
                  <span
                    className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday(day) ? "bg-tone-agenda text-on-tone" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </button>
                <div className="mt-1 space-y-1">
                  {allDay.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onOpen(e)}
                      className="ev-chip block min-h-11 w-full break-words rounded-md py-1.5 pl-2.5 pr-1.5 text-left text-xs font-bold leading-snug sm:min-h-8 sm:text-[0.8125rem]"
                      style={evVars(e)}
                      title={e.title}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Heures */}
        <div>
          <div className="grid relative" style={cols}>
            <div className="sticky left-0 z-20 bg-card">
              {HOURS.map((h) => (
                <div key={h} className="relative pr-1.5 text-right text-xs tabular-nums text-muted-foreground" style={{ height: HOUR_PX }}>
                  {h > 0 && <span className="absolute -top-2 right-1.5">{`${h}:00`}</span>}
                </div>
              ))}
            </div>
            {days.map((day) => {
              const timed = events.filter((e) => !isAllDayLike(e) && occursOn(e, day));
              const positioned = layoutDay(timed, day);
              const nowTop = isToday(day) ? (now.getHours() * 60 + now.getMinutes()) * (HOUR_PX / 60) : null;
              return (
                <div key={day.toISOString()} className="relative border-l border-border">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      aria-label={`Nouvel événement le ${format(day, "d MMMM", { locale: fr })} à ${h} h`}
                      onClick={() => onCreateAt(day, h)}
                      className="block w-full border-b border-border/60 hover:bg-accent/50 transition-colors"
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {positioned.map(({ event, top, height, column, columns }) => {
                    const px = Math.max(height * (HOUR_PX / 60) - 2, 24);
                    const time = startTimePrefix(event);
                    const lines = Math.max(1, Math.floor((px - 6) / 16));
                    return (
                      <button
                        key={event.id}
                        onClick={() => onOpen(event)}
                        title={`${time ?? ""} ${event.title}`.trim()}
                        className="ev-chip absolute overflow-hidden rounded-md border border-card py-0.5 pl-2 pr-1 text-left text-xs leading-4 sm:text-[0.8125rem] sm:leading-4"
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
                          {time && <span className="font-extrabold tabular-nums">{time} </span>}
                          <span className="font-semibold">{event.title}</span>
                        </span>
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
