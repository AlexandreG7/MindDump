"use client";

import { useEffect, useRef, useState } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarEvent } from "./types";
import { eventStyle, isAllDayLike, layoutDay, occursOn } from "./utils";

const HOUR_PX = 48;
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
}: {
  days: Date[];
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDay: (day: Date) => void;
  onCreateAt: (day: Date, hour: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  // Ouvre la grille vers 7 h plutôt qu'à minuit.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const single = days.length === 1;
  const cols = { gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` };
  const minWidth = single ? undefined : "40rem";

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <div style={{ minWidth }}>
        {/* En-têtes et journées entières */}
        <div className="grid border-b border-border bg-muted/40" style={cols}>
          <div />
          {days.map((day) => {
            const allDay = events.filter((e) => isAllDayLike(e) && occursOn(e, day));
            const selected = selectedDate && isSameDay(day, selectedDate);
            return (
              <div key={day.toISOString()} className="border-l border-border p-1 min-w-0">
                <button
                  onClick={() => onSelectDay(day)}
                  className={`w-full flex flex-col items-center py-1 rounded-md transition-colors hover:bg-accent ${selected ? "bg-accent" : ""}`}
                >
                  <span className="text-[11px] uppercase text-muted-foreground">
                    {format(day, single ? "EEEE" : "EEE", { locale: fr })}
                  </span>
                  <span
                    className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday(day) ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </button>
                <div className="space-y-0.5 mt-1">
                  {allDay.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onSelectDay(day)}
                      className={`block w-full text-left text-xs rounded px-1.5 py-0.5 truncate ${e.color ? "" : "bg-primary/10 text-primary"}`}
                      style={eventStyle(e)}
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
        <div ref={scrollRef} className="overflow-y-auto max-h-[65vh]">
          <div className="grid relative" style={cols}>
            <div>
              {HOURS.map((h) => (
                <div key={h} className="relative text-[10px] text-muted-foreground text-right pr-1.5" style={{ height: HOUR_PX }}>
                  {h > 0 && <span className="absolute -top-1.5 right-1.5">{`${h}:00`}</span>}
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
                  {positioned.map(({ event, top, height, column, columns }) => (
                    <button
                      key={event.id}
                      onClick={() => onSelectDay(day)}
                      title={`${format(new Date(event.date), "HH:mm")} ${event.title}`}
                      className={`absolute rounded-md px-1.5 py-0.5 text-left text-xs overflow-hidden border border-background ${
                        event.color ? "" : "bg-primary text-primary-foreground"
                      }`}
                      style={{
                        top: top * (HOUR_PX / 60),
                        height: Math.max(height * (HOUR_PX / 60) - 2, 18),
                        left: `calc(${(column / columns) * 100}% + 2px)`,
                        width: `calc(${100 / columns}% - 4px)`,
                        ...eventStyle(event, true),
                      }}
                    >
                      <span className="font-medium block truncate">{event.title}</span>
                      {height >= 45 && (
                        <span className="opacity-80 block truncate">{format(new Date(event.date), "HH:mm")}</span>
                      )}
                    </button>
                  ))}
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
