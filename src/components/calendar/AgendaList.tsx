"use client";

import { addDays, format, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarEvent } from "./types";
import { EventList } from "./EventList";
import { AGENDA_DAYS, occursOn, sortEvents } from "./utils";

function dayLabel(day: Date): string {
  if (isToday(day)) return `Aujourd'hui · ${format(day, "d MMMM", { locale: fr })}`;
  if (isTomorrow(day)) return `Demain · ${format(day, "d MMMM", { locale: fr })}`;
  return format(day, "EEEE d MMMM", { locale: fr });
}

/** Liste chronologique des jours qui ont des événements, à partir de `from`. */
export function AgendaList({
  from,
  events,
  onSetColor,
  onDelete,
}: {
  from: Date;
  events: CalendarEvent[];
  onSetColor: (id: string, color: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(from, i))
    .map((day) => ({ day, events: sortEvents(events.filter((e) => occursOn(e, day))) }))
    .filter((d) => d.events.length > 0);

  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Rien de prévu sur les {AGENDA_DAYS} prochains jours.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {days.map(({ day, events: dayEvents }) => (
        <section key={day.toISOString()}>
          <h3
            className={`text-sm font-semibold first-letter:uppercase mb-2 pb-1 border-b border-border ${
              isToday(day) ? "text-primary" : ""
            }`}
          >
            {dayLabel(day)}
          </h3>
          <EventList events={dayEvents} day={day} onSetColor={onSetColor} onDelete={onDelete} />
        </section>
      ))}
    </div>
  );
}
