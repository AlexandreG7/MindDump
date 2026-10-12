"use client";

import { format } from "date-fns";
import { AlignLeft, Bell, Check, Clock, Pencil, Repeat, Rss, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EVENT_COLORS, RECURRENCE_LABELS } from "@/lib/recurrence";
import { reminderLabel } from "@/lib/reminderOptions";
import { AssigneePicker } from "@/components/profiles/Assignees";
import { textOn, type FamilyProfile } from "@/components/profiles/ProfileAvatar";
import type { CalendarEvent } from "./types";
import { resolveEventColor, daysCovered, eventEnd, eventStart, formatEventRange, isAllDayLike } from "./utils";

function whenText(e: CalendarEvent): string {
  const start = eventStart(e);
  if (e.allDay) {
    const n = daysCovered(e);
    return n > 1 ? `Toute la journée · ${n} jours` : "Toute la journée";
  }
  if (isAllDayLike(e)) return `dès ${format(start, "HH:mm")} · jusqu'à ${format(eventEnd(e), "HH:mm")}`;
  return e.endDate ? `${format(start, "HH:mm")} – ${format(eventEnd(e), "HH:mm")}` : format(start, "HH:mm");
}

function Line({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 text-base">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-tone-agenda-ink" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

/**
 * Fiche d'un événement : on lit d'abord (quand, quoi, pour qui), les réglages
 * personnes et couleur sont au même endroit, « Modifier » rouvre le formulaire.
 * Les événements d'un calendrier externe sont en lecture seule.
 */
export function EventSheet({
  event,
  onOpenChange,
  profiles,
  onEdit,
  onDelete,
  onSetColor,
  onSetAssignees,
}: {
  event: CalendarEvent | null;
  onOpenChange: (open: boolean) => void;
  profiles: { all: FamilyProfile[]; byId: Map<string, FamilyProfile> };
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onSetColor: (id: string, color: string | null) => void;
  onSetAssignees: (id: string, assigneeIds: string[]) => void;
}) {
  const color = event ? (event.displayColor ?? event.color ?? null) : null;
  const defaultColor = event ? resolveEventColor(null, event.assigneeIds, profiles.byId) : "";
  const editable = !!event && !event.subscriptionId;
  const groupId = event?.assigneeIds?.map((id) => profiles.byId.get(id)?.groupId).find(Boolean);
  const choices = groupId ? profiles.all.filter((p) => p.groupId === groupId) : profiles.all;
  const people = (event?.assigneeIds ?? []).map((id) => profiles.byId.get(id)).filter((p): p is FamilyProfile => !!p);

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 outline-none",
          "[&>button:last-child]:right-2 [&>button:last-child]:top-3 [&>button:last-child]:p-3.5",
          "max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-t-[1.75rem] max-sm:border-x-0 max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom"
        )}
      >
        {event && (
          <>
            <div
              aria-hidden
              className={cn("h-2.5 shrink-0", !color && "bg-tone-agenda")}
              style={color ? { backgroundColor: color } : undefined}
            />
            <DialogHeader className="px-6 pb-3 pr-14 pt-5 text-left">
              <DialogTitle className="font-display break-words text-[1.75rem] leading-[1.1] tracking-normal">
                {event.title}
              </DialogTitle>
              <DialogDescription className="text-base first-letter:uppercase">{formatEventRange(event)}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-6 pb-4">
              <Line icon={Clock}>{whenText(event)}</Line>
              {event.recurrence && RECURRENCE_LABELS[event.recurrence] && (
                <Line icon={Repeat}>{RECURRENCE_LABELS[event.recurrence]}</Line>
              )}
              {event.notifyBefore !== null && event.notifyBefore !== undefined && !event.allDay && (
                <Line icon={Bell}>Rappel : {reminderLabel(event.notifyBefore).toLowerCase()}</Line>
              )}
              {event.subscriptionName && <Line icon={Rss}>Calendrier « {event.subscriptionName} »</Line>}
              {event.description && (
                <Line icon={AlignLeft}>
                  <span className="whitespace-pre-line text-muted-foreground">{event.description}</span>
                </Line>
              )}
              {!editable && people.length > 0 && <Line icon={Users}>{people.map((p) => p.name).join(", ")}</Line>}
              {editable && choices.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-sm font-bold text-muted-foreground">Pour qui ?</p>
                  <AssigneePicker
                    profiles={choices}
                    value={event.assigneeIds ?? []}
                    onChange={(ids) => onSetAssignees(event.id, ids)}
                  />
                </div>
              )}
              {editable && (
                <div className="space-y-2 pt-1">
                  <p id="event-sheet-color" className="text-sm font-bold text-muted-foreground">
                    Couleur
                  </p>
                  <div className="flex flex-wrap items-center gap-2 touch:gap-3" role="radiogroup" aria-labelledby="event-sheet-color">
                    {[{ value: null as string | null, label: "Par défaut" }, ...EVENT_COLORS].map((c) => {
                      const on = (event.color ?? null) === c.value;
                      return (
                        <button
                          key={c.value ?? "default"}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={c.value ? c.label : "Par défaut (couleur de la personne, sinon bleu)"}
                          title={c.value ? c.label : "Par défaut"}
                          onClick={() => onSetColor(event.id, c.value)}
                          style={{ backgroundColor: c.value ?? defaultColor }}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 touch:h-12 touch:w-12",
                            !c.value && "border-2 border-dashed border-foreground/40",
                            on ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-110"
                          )}
                        >
                          {on && (
                            <Check
                              className="h-4 w-4 touch:h-6 touch:w-6"
                              strokeWidth={3}
                              style={{ color: textOn(c.value ?? defaultColor) }}
                              aria-hidden
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {editable && (
              <div className="flex items-center gap-2 border-t bg-background px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Supprimer l'événement"
                  title="Supprimer"
                  onClick={() => onDelete(event)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button type="button" className="h-12 flex-1 text-base" onClick={() => onEdit(event)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
