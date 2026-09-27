"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Palette, Repeat, Trash2 } from "lucide-react";
import { EVENT_COLORS, RECURRENCE_LABELS } from "@/lib/recurrence";
import type { CalendarEvent } from "./types";
import { eventEnd, eventStart, isAllDayLike } from "./utils";

function timeLabel(e: CalendarEvent, day?: Date): string | null {
  if (e.allDay) return null;
  const start = eventStart(e);
  const end = e.endDate ? eventEnd(e) : null;
  if (isAllDayLike(e) && day) {
    // Plusieurs jours : l'heure n'a de sens que le premier et le dernier jour.
    const sameDay = (d: Date) => d.toDateString() === day.toDateString();
    if (sameDay(start)) return `dès ${format(start, "HH:mm")}`;
    if (end && sameDay(end)) return `jusqu'à ${format(end, "HH:mm")}`;
    return null;
  }
  return end ? `${format(start, "HH:mm")} – ${format(end, "HH:mm")}` : format(start, "HH:mm");
}

/** Événements d'un jour, avec couleur et suppression pour ceux de MindDump. */
export function EventList({
  events,
  day,
  onSetColor,
  onDelete,
}: {
  events: CalendarEvent[];
  day?: Date;
  onSetColor: (id: string, color: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [colorMenuFor, setColorMenuFor] = useState<string | null>(null);

  return (
    <ul className="space-y-3">
      {events.map((event) => {
        const time = timeLabel(event, day);
        return (
          <li key={event.id} className="group flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <div
                className={`w-1 self-stretch min-h-[20px] rounded-full mt-0.5 shrink-0 ${event.color ? "" : "bg-primary/40"}`}
                style={event.color ? { backgroundColor: event.color } : undefined}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <span className="truncate">{event.title}</span>
                  {event.recurrence && RECURRENCE_LABELS[event.recurrence] && (
                    <span className="text-muted-foreground shrink-0" title={RECURRENCE_LABELS[event.recurrence]}>
                      <Repeat className="h-3 w-3" />
                    </span>
                  )}
                </p>
                {(time || event.subscriptionName) && (
                  <p className="text-xs text-muted-foreground">
                    {[time, event.subscriptionName].filter(Boolean).join(" · ")}
                  </p>
                )}
                {event.description && (
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{event.description}</p>
                )}
              </div>
            </div>
            {!event.subscriptionId && (
              <div className="flex items-center gap-0.5 shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setColorMenuFor(colorMenuFor === event.id ? null : event.id)}
                    title="Couleur"
                    className={`p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-all ${
                      colorMenuFor === event.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100 touch:opacity-100"
                    }`}
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </button>
                  {colorMenuFor === event.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setColorMenuFor(null)} />
                      <div className="absolute right-0 bottom-full mb-1 z-50 w-max bg-popover border border-border rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1.5">
                        <button
                          onClick={() => { setColorMenuFor(null); onSetColor(event.id, null); }}
                          title="Par défaut"
                          className="w-5 h-5 rounded-full border border-border bg-primary/10 hover:scale-110 transition-transform"
                        />
                        {EVENT_COLORS.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => { setColorMenuFor(null); onSetColor(event.id, c.value); }}
                            title={c.label}
                            style={{ backgroundColor: c.value }}
                            className={`w-5 h-5 rounded-full hover:scale-110 transition-transform ${
                              event.color === c.value ? "ring-2 ring-offset-1 ring-offset-popover ring-foreground" : ""
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => onDelete(event.id)}
                  title="Supprimer"
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 touch:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
