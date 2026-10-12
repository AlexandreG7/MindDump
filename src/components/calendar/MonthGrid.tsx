"use client";

import { addDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./types";
import { daySpan, eventStart, eventStyle, hasColor, occursOn } from "./utils";

const WEEK = { weekStartsOn: 1 as const };

export function monthDays(month: Date): Date[] {
  const days: Date[] = [];
  const end = endOfWeek(endOfMonth(month), WEEK);
  for (let d = startOfWeek(startOfMonth(month), WEEK); d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Événements sur plusieurs jours d'abord (ils gardent ainsi leur rang d'un jour à l'autre), puis journées entières, puis par heure. */
function monthOrder(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const rank = (e: CalendarEvent) => (daySpan(e, day) ? 0 : e.allDay ? 1 : 2);
  return [...events].sort((a, b) => rank(a) - rank(b) || eventStart(a).getTime() - eventStart(b).getTime());
}

const MAX_BARS = 3;

/**
 * Mois en grille. Un événement sur plusieurs jours forme une bande continue
 * (titre le premier jour et chaque lundi) ; sur téléphone, les événements sont
 * de fines bandes colorées et le détail du jour choisi s'affiche dessous.
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
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
      <div className="grid grid-cols-7 bg-tone-agenda-soft">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-extrabold uppercase tracking-wide text-tone-agenda-ink">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border/70">
        {monthDays(month).map((d) => {
          const dayEvents = monthOrder(events.filter((e) => occursOn(e, d)), d);
          const isSelected = !!selectedDate && isSameDay(d, selectedDate);
          const today = isToday(d);
          const hidden = dayEvents.length - MAX_BARS;
          return (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              aria-pressed={isSelected}
              aria-label={`${format(d, "EEEE d MMMM", { locale: fr })}, ${
                dayEvents.length === 0 ? "rien de prévu" : `${dayEvents.length} événement${dayEvents.length > 1 ? "s" : ""}`
              }`}
              className={cn(
                "flex min-h-[5.25rem] min-w-0 flex-col items-stretch gap-1 bg-card px-1.5 pb-1.5 pt-1.5 text-left transition-colors duration-150 hover:bg-secondary/60 sm:min-h-[6.5rem] sm:px-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                !isSameMonth(d, month) && "opacity-40",
                isSelected && "bg-tone-agenda-soft hover:bg-tone-agenda-soft"
              )}
            >
              <span
                className={cn(
                  "font-display grid h-7 w-7 place-items-center rounded-full text-[0.9375rem] leading-none tabular-nums",
                  today && "bg-tone-agenda text-on-tone",
                  !today && isSelected && "bg-tone-agenda-ink text-tone-agenda-soft"
                )}
              >
                {format(d, "d")}
              </span>
              <span className="flex flex-col gap-[3px]" aria-hidden>
                {dayEvents.slice(0, MAX_BARS).map((e) => {
                  const span = daySpan(e, d);
                  const first = !span || span.index === 1 || d.getDay() === 1;
                  const last = !span || span.index === span.total || d.getDay() === 0;
                  const showTitle = first;
                  return (
                    <span
                      key={e.id}
                      className={cn(
                        "block h-1.5 truncate text-xs leading-[1.125rem] sm:h-[1.125rem]",
                        !hasColor(e) && "bg-tone-agenda text-on-tone",
                        first ? "rounded-l-full sm:pl-1.5" : "-ml-[7px] sm:-ml-[9px]",
                        last ? "rounded-r-full sm:pr-1" : "-mr-1.5 sm:-mr-2",
                        !showTitle && "sm:text-transparent"
                      )}
                      style={eventStyle(e, true)}
                    >
                      <span className="max-sm:hidden">{showTitle ? e.title : "\u00a0"}</span>
                    </span>
                  );
                })}
                {hidden > 0 && <span className="text-[0.6875rem] font-bold leading-none text-muted-foreground">+{hidden}</span>}
              </span>
            </button>
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
