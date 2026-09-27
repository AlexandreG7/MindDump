"use client";

import { addDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import type { CalendarEvent } from "./types";
import { eventStyle, hasColor, occursOn, sortEvents } from "./utils";

const WEEK = { weekStartsOn: 1 as const };

export function monthDays(month: Date): Date[] {
  const days: Date[] = [];
  const end = endOfWeek(endOfMonth(month), WEEK);
  for (let d = startOfWeek(startOfMonth(month), WEEK); d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

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
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
        <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">
          {d}
        </div>
      ))}
      {monthDays(month).map((d) => {
        const dayEvents = sortEvents(events.filter((e) => occursOn(e, d)));
        const isSelected = selectedDate && isSameDay(d, selectedDate);
        return (
          <div
            key={d.toISOString()}
            className={`bg-background p-1.5 sm:p-2 min-h-[80px] cursor-pointer transition-colors hover:bg-accent min-w-0 ${
              !isSameMonth(d, month) ? "opacity-30" : ""
            } ${isSelected ? "ring-2 ring-inset ring-primary" : ""}`}
            onClick={() => onSelectDay(d)}
          >
            <span
              className={`text-sm ${
                isToday(d) ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : ""
              }`}
            >
              {format(d, "d")}
            </span>
            {dayEvents.slice(0, 2).map((e) => (
              <div
                key={e.id}
                className={`text-xs rounded px-1 mt-1 truncate ${!hasColor(e) ? "bg-primary/10 text-primary" : ""}`}
                style={eventStyle(e)}
              >
                {e.title}
              </div>
            ))}
            {dayEvents.length > 2 && (
              <div className="text-xs text-muted-foreground mt-1">+{dayEvents.length - 2}</div>
            )}
          </div>
        );
      })}
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
        <div
          key={month.toISOString()}
          className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onSelectMonth(month)}
        >
          <p className="text-sm font-semibold capitalize mb-2">
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
                    isToday(dd) ? "font-bold text-primary" : ""
                  }`}
                >
                  {format(dd, "d")}
                  {hasEvents && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
