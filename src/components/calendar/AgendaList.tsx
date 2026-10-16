"use client";

import { addDays, format, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import type { CalendarEvent } from "./types";
import { EventList } from "./EventList";
import type { FamilyProfile } from "@/components/profiles/ProfileAvatar";
import { AGENDA_DAYS, occursOn, sortEvents } from "./utils";

function dayTitle(day: Date): string {
  if (isToday(day)) return "Aujourd'hui";
  if (isTomorrow(day)) return "Demain";
  return format(day, "EEEE", { locale: fr });
}

/**
 * Liste chronologique des jours qui ont des événements, à partir de `from` :
 * une pastille de date à gauche, les événements du jour à droite. Un événement
 * sur plusieurs jours est détaillé le premier jour, puis rappelé en une ligne.
 */
export function AgendaList({
  from,
  events,
  onOpen,
  onSetColor,
  onSetAssignees,
  onDelete,
  profiles,
  selectedId,
}: {
  from: Date;
  events: CalendarEvent[];
  onOpen: (event: CalendarEvent) => void;
  onSetColor: (id: string, color: string | null) => void;
  onSetAssignees: (id: string, assigneeIds: string[]) => void;
  onDelete: (event: CalendarEvent) => void;
  profiles: { all: FamilyProfile[]; byId: Map<string, FamilyProfile> };
  selectedId?: string | null;
}) {
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(from, i))
    .map((day) => ({ day, events: sortEvents(events.filter((e) => occursOn(e, day))) }))
    .filter((d) => d.events.length > 0);

  if (days.length === 0) {
    return (
      <EmptyState icon={CalendarCheck} tone="agenda" title="Rien de prévu.">
        Aucun événement sur les {AGENDA_DAYS} prochains jours.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      {days.map(({ day, events: dayEvents }) => {
        const today = isToday(day);
        return (
          <section key={day.toISOString()} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3">
            <div
              aria-hidden
              className={cn(
                "flex h-15 w-13 flex-col items-center justify-center rounded-2xl",
                today ? "bg-tone-agenda text-on-tone" : "bg-tone-agenda-soft text-tone-agenda-ink"
              )}
            >
              <span className="text-[0.6875rem] font-extrabold uppercase leading-none tracking-wide">
                {format(day, "EEE", { locale: fr }).replace(".", "")}
              </span>
              <span className="font-display mt-1 text-[1.625rem] leading-none tabular-nums">{format(day, "d")}</span>
            </div>
            <div className="min-w-0">
              <h3 className="mb-2 flex min-h-7 flex-wrap items-baseline gap-x-2 pt-0.5">
                <span className={cn("text-lg font-extrabold leading-tight first-letter:uppercase", today && "text-tone-agenda-ink")}>{dayTitle(day)}</span>
                <span className="text-sm text-muted-foreground">
                  {format(day, "d MMMM", { locale: fr })} · {dayEvents.length} {dayEvents.length > 1 ? "événements" : "événement"}
                </span>
              </h3>
              <EventList
                events={dayEvents}
                day={day}
                onOpen={onOpen}
                onSetColor={onSetColor}
                onSetAssignees={onSetAssignees}
                onDelete={onDelete}
                profiles={profiles}
                selectedId={selectedId}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
