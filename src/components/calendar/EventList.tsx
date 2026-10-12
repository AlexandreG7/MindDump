"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, Palette, Repeat, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_COLORS, RECURRENCE_LABELS } from "@/lib/recurrence";
import type { CalendarEvent } from "./types";
import { AssigneeAvatars, AssigneePicker } from "@/components/profiles/Assignees";
import { textOn, type FamilyProfile } from "@/components/profiles/ProfileAvatar";
import { daySpan, eventEnd, eventStart, isAllDayLike, isFinished } from "./utils";

export function timeLabel(e: CalendarEvent, day?: Date): string | null {
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

/** Une pastille par jour de l'événement, remplie jusqu'au jour affiché. */
function SpanPips({ index, total, color }: { index: number; total: number; color: string | null }) {
  if (total > 14) return null;
  return (
    <span aria-hidden className="mt-1.5 flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn("h-1.5 flex-1 rounded-full", i < index ? (color ? "" : "bg-tone-agenda-ink") : "bg-foreground/10")}
          style={i < index && color ? { backgroundColor: color } : undefined}
        />
      ))}
    </span>
  );
}

/**
 * Événements d'un jour. Toute la ligne ouvre la fiche (lecture d'abord) ; les
 * raccourcis personnes, couleur et suppression restent au survol sur ordinateur,
 * et sur téléphone la fiche donne accès à tout (cibles de 44 px et plus).
 */
export function EventList({
  events,
  day,
  onOpen,
  onSetColor,
  onSetAssignees,
  onDelete,
  profiles,
}: {
  events: CalendarEvent[];
  day?: Date;
  onOpen: (event: CalendarEvent) => void;
  onSetColor: (id: string, color: string | null) => void;
  onSetAssignees: (id: string, assigneeIds: string[]) => void;
  onDelete: (event: CalendarEvent) => void;
  profiles: { all: FamilyProfile[]; byId: Map<string, FamilyProfile> };
}) {
  const [colorMenuFor, setColorMenuFor] = useState<string | null>(null);
  const [peopleMenuFor, setPeopleMenuFor] = useState<string | null>(null);
  const now = new Date();

  return (
    <ul className="space-y-2">
      {events.map((event) => {
        const time = timeLabel(event, day);
        const span = day ? daySpan(event, day) : null;
        const color = event.displayColor ?? event.color ?? null;
        const done = !!day && day.toDateString() === now.toDateString() && isFinished(event, now);
        const continuing = !!span && span.index > 1;

        if (continuing && span) {
          // Jour suivant d'un événement déjà annoncé : une ligne discrète suffit.
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onOpen(event)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-dashed border-border px-3 text-left text-sm transition-[transform,background-color] duration-150 hover:bg-secondary/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className={cn("h-3 w-3 shrink-0 rounded-full", !color && "bg-tone-agenda-ink")}
                  style={color ? { backgroundColor: color } : undefined}
                />
                <span className="min-w-0 flex-1 truncate font-semibold">{event.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  Jour {span.index}/{span.total}
                  {time ? ` · ${time}` : ""}
                </span>
              </button>
            </li>
          );
        }

        return (
          <li key={event.id} className={cn("group/card transition-opacity", done && "opacity-60")}>
            <div className="flex items-stretch rounded-2xl border border-border/70 bg-card">
              <button
                type="button"
                onClick={() => onOpen(event)}
                className="flex min-h-14 min-w-0 flex-1 items-stretch gap-3 rounded-2xl py-2.5 pl-3 pr-3 text-left transition-[transform,background-color] duration-150 hover:bg-secondary/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className={cn("w-1.5 shrink-0 rounded-full", !color && "bg-tone-agenda-ink/60")}
                  style={color ? { backgroundColor: color } : undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-base font-bold leading-snug">{event.title}</span>
                  {(time || span || event.subscriptionName || (event.assigneeIds?.length ?? 0) > 0) && (
                    <span className="block text-sm text-muted-foreground">
                      {[
                        time,
                        span && `jusqu'au ${format(span.lastDay, "EEE d MMM", { locale: fr })} · ${span.total} jours`,
                        event.subscriptionName,
                        (event.assigneeIds ?? [])
                          .map((id) => profiles.byId.get(id)?.name)
                          .filter(Boolean)
                          .join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {event.description && (
                    <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{event.description}</span>
                  )}
                  {span && <SpanPips index={span.index} total={span.total} color={color} />}
                </span>
                <span className="flex shrink-0 flex-col items-end justify-between gap-1">
                  <AssigneeAvatars ids={event.assigneeIds} byId={profiles.byId} />
                  {event.recurrence && RECURRENCE_LABELS[event.recurrence] && (
                    <span className="text-muted-foreground" title={RECURRENCE_LABELS[event.recurrence]}>
                      <Repeat className="h-3.5 w-3.5" aria-label={RECURRENCE_LABELS[event.recurrence]} />
                    </span>
                  )}
                </span>
              </button>
              {!event.subscriptionId && (
                <div className="flex shrink-0 items-center gap-0.5 pr-1.5 touch:hidden">
                  {(() => {
                    // Personnes du groupe de l'événement (celui de ses personnes déjà assignées, sinon tous).
                    const groupId = event.assigneeIds?.map((id) => profiles.byId.get(id)?.groupId).find(Boolean);
                    const choices = groupId ? profiles.all.filter((p) => p.groupId === groupId) : profiles.all;
                    if (choices.length === 0) return null;
                    return (
                      <div className="relative">
                        <button
                          onClick={() => setPeopleMenuFor(peopleMenuFor === event.id ? null : event.id)}
                          title="Pour qui ?"
                          aria-label="Choisir les personnes"
                          className={cn(
                            "rounded-md p-1.5 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground",
                            peopleMenuFor === event.id ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover/card:opacity-100"
                          )}
                        >
                          <Users className="h-3.5 w-3.5" />
                        </button>
                        {peopleMenuFor === event.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setPeopleMenuFor(null)} />
                            <div className="absolute bottom-full right-0 z-50 mb-1 w-64 space-y-2 rounded-xl border border-border bg-popover p-3 shadow-lg">
                              <p className="text-xs font-medium text-muted-foreground">Pour qui ?</p>
                              <AssigneePicker
                                profiles={choices}
                                value={event.assigneeIds ?? []}
                                onChange={(ids) => onSetAssignees(event.id, ids)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  <div className="relative">
                    <button
                      onClick={() => setColorMenuFor(colorMenuFor === event.id ? null : event.id)}
                      title="Couleur"
                      aria-label="Choisir la couleur"
                      className={cn(
                        "rounded-md p-1.5 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground",
                        colorMenuFor === event.id ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover/card:opacity-100"
                      )}
                    >
                      <Palette className="h-3.5 w-3.5" />
                    </button>
                    {colorMenuFor === event.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setColorMenuFor(null)} />
                        <div
                          role="radiogroup"
                          aria-label="Couleur de l'événement"
                          className="absolute bottom-full right-0 z-50 mb-1 grid w-max grid-cols-5 gap-1.5 rounded-xl border border-border bg-popover p-2 shadow-lg"
                        >
                          {[{ value: null as string | null, label: "Par défaut" }, ...EVENT_COLORS].map((c) => {
                            const on = (event.color ?? null) === c.value;
                            return (
                              <button
                                key={c.value ?? "default"}
                                role="radio"
                                aria-checked={on}
                                aria-label={c.label}
                                onClick={() => {
                                  setColorMenuFor(null);
                                  onSetColor(event.id, c.value);
                                }}
                                title={c.label}
                                style={c.value ? { backgroundColor: c.value } : undefined}
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-90",
                                  !c.value && "border border-border bg-primary/10",
                                  on && "ring-2 ring-foreground ring-offset-1 ring-offset-popover"
                                )}
                              >
                                {on && (
                                  <Check
                                    className="h-3 w-3"
                                    strokeWidth={3}
                                    style={{ color: c.value ? textOn(c.value) : undefined }}
                                    aria-hidden
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(event)}
                    title="Supprimer"
                    aria-label="Supprimer l'événement"
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-secondary hover:text-destructive focus:opacity-100 group-hover/card:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
