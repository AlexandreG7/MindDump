"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_COLORS, RECURRENCE_OPTIONS } from "@/lib/recurrence";
import { ReminderField } from "@/components/reminders/ReminderField";
import { joinDue } from "@/lib/todoDue";
import { DEFAULT_REMINDER, NO_REMINDER, settleReminder } from "@/lib/reminderOptions";
import { AssigneePicker } from "@/components/profiles/Assignees";
import { textOn, type FamilyProfile } from "@/components/profiles/ProfileAvatar";

export interface EventDraft {
  title: string;
  description: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm, vide = journée entière
  /** Dernier jour (yyyy-MM-dd), facultatif : vide = événement d'un seul jour. */
  endDate: string;
  endTime: string; // HH:mm, facultatif
  recurrence: string;
  color: string;
  /** Valeur du menu de rappel (voir reminderOptions) : « none », « 0 », « 15 »… */
  notifyBefore: string;
  assigneeIds: string[];
}

export const emptyDraft = (date = "", time = ""): EventDraft => ({
  title: "",
  description: "",
  date,
  time,
  endDate: "",
  endTime: "",
  recurrence: "",
  color: "",
  notifyBefore: NO_REMINDER,
  assigneeIds: [],
});

/** Instant de début (ISO) d'un brouillon, null pour une journée entière. */
const startOf = (date: string, time: string) => {
  if (!date || !time) return null;
  return joinDue(date, time);
};

/** Création d'un événement, éventuellement pré-rempli (clic sur un créneau). */
export function EventDialog({
  open,
  onOpenChange,
  initial,
  profiles,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EventDraft;
  profiles: FamilyProfile[];
  onSubmit: (draft: EventDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EventDraft>(initial);
  // Rappel voulu avant un ajustement automatique (voir settleReminder).
  const [wanted, setWanted] = useState(NO_REMINDER);

  useEffect(() => {
    if (!open) return;
    // À la création, 15 min avant si l'événement a une heure (et si ce n'est
    // pas déjà passé : un créneau cliqué dans le passé donne « Pas de rappel »).
    const want = initial.time && initial.notifyBefore === NO_REMINDER ? DEFAULT_REMINDER : initial.notifyBefore;
    setWanted(want);
    setDraft({
      ...initial,
      notifyBefore: settleReminder(startOf(initial.date, initial.time), want, Date.now()),
    });
  }, [open, initial]);

  // Le rappel suit le début : sans heure (journée entière) il n'y a rien à
  // rappeler ; la première heure saisie propose 15 min ; une heure plus proche
  // ramène le rappel à la plus longue option encore possible.
  const setStart = (date: string, time: string) => {
    const want = time && !draft.time && wanted === NO_REMINDER ? DEFAULT_REMINDER : wanted;
    setWanted(want);
    setDraft({
      ...draft,
      date,
      time,
      // Un dernier jour antérieur au nouveau début n'a plus de sens.
      endDate: draft.endDate && draft.endDate > date ? draft.endDate : "",
      endTime: time ? draft.endTime : "",
      notifyBefore: time ? settleReminder(startOf(date, time), want, Date.now()) : NO_REMINDER,
    });
  };

  const multiDay = !!draft.endDate && draft.endDate > draft.date;
  const endDateInvalid = !!draft.endDate && !!draft.date && draft.endDate < draft.date;
  // Le même jour, la fin suit le début ; sur plusieurs jours, toute heure de fin convient.
  const endInvalid =
    endDateInvalid || (!multiDay && !!draft.time && !!draft.endTime && draft.endTime <= draft.time);

  const submit = async () => {
    if (!draft.title.trim() || !draft.date || endInvalid) return;
    await onSubmit(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Défile si l'écran est bas (téléphone, tablette en paysage) et laisse la place de l'encoche et de la barre d'accueil. */}
      <DialogContent className="max-h-[calc(100dvh_-_1rem_-_2*max(env(safe-area-inset-top),env(safe-area-inset-bottom)))] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Ajouter un événement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="eventdialog-titre">Titre</Label>
            <Input id="eventdialog-titre"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="eventdialog-description-optionnel">Description (optionnel)</Label>
            <Textarea id="eventdialog-description-optionnel" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eventdialog-date">Date</Label>
              <Input id="eventdialog-date" type="date" value={draft.date} onChange={(e) => setStart(e.target.value, draft.time)} />
            </div>
            <div>
              <Label htmlFor="eventdialog-debut">Début</Label>
              <Input id="eventdialog-debut"
                type="time"
                value={draft.time}
                onChange={(e) => setStart(draft.date, e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="eventdialog-date-fin">Dernier jour (optionnel)</Label>
              <Input id="eventdialog-date-fin"
                type="date"
                value={draft.endDate}
                min={draft.date || undefined}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="eventdialog-fin">Fin</Label>
              <Input id="eventdialog-fin"
                type="time"
                value={draft.endTime}
                disabled={!draft.time}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
              />
            </div>
          </div>
          <p className={`text-xs -mt-2 ${endInvalid ? "text-destructive" : "text-muted-foreground"}`}>
            {endDateInvalid
              ? "Le dernier jour ne peut pas précéder la date."
              : endInvalid
                ? "L'heure de fin doit suivre l'heure de début."
                : multiDay
                  ? !draft.time
                    ? "Sur plusieurs jours, sans heure : chaque jour est affiché en journée entière."
                    : !draft.endTime
                      ? "Sans heure de fin, le dernier jour dure jusqu'au soir."
                      : "\u00a0"
                  : !draft.time
                    ? "Sans heure, l'événement occupe toute la journée."
                    : !draft.endTime
                      ? "Sans heure de fin, l'événement dure une heure dans l'agenda."
                      : "\u00a0"}
          </p>
          {profiles.length > 0 && (
            <div className="space-y-1.5">
              <Label>Pour qui ?</Label>
              <AssigneePicker
                profiles={profiles}
                value={draft.assigneeIds}
                onChange={(assigneeIds) => setDraft({ ...draft, assigneeIds })}
              />
            </div>
          )}
          <div>
            <Label htmlFor="eventdialog-recurrence">Récurrence</Label>
            <Select value={draft.recurrence} onValueChange={(v) => setDraft({ ...draft, recurrence: v })}>
              <SelectTrigger id="eventdialog-recurrence">
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Couleur</Label>
            <div className="flex items-center gap-2 touch:gap-3 flex-wrap mt-2" role="radiogroup" aria-label="Couleur">
              {[{ value: "", label: "Par défaut" }, ...EVENT_COLORS].map((c) => {
                const on = draft.color === c.value;
                return (
                  <button
                    key={c.value || "default"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => setDraft({ ...draft, color: c.value })}
                    style={c.value ? { backgroundColor: c.value } : undefined}
                    className={`relative flex items-center justify-center rounded-full w-6 h-6 touch:w-12 touch:h-12 transition-transform duration-150 active:scale-90 ${
                      c.value ? "" : "border border-border bg-primary/10"
                    } ${on ? "ring-2 ring-offset-2 ring-offset-background ring-primary" : "hover:scale-110"}`}
                  >
                    {/* Sélection lisible sans la couleur : coche sur la pastille */}
                    {on && (
                      <Check
                        className="h-3.5 w-3.5 touch:h-6 touch:w-6"
                        strokeWidth={3}
                        style={{ color: c.value ? textOn(c.value) : undefined }}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <ReminderField
            id="eventdialog-rappel"
            dueIso={startOf(draft.date, draft.time)}
            value={draft.notifyBefore}
            wanted={wanted}
            onChange={(v) => {
              setWanted(v);
              setDraft({ ...draft, notifyBefore: v });
            }}
            unavailableHint="Ajoute une heure de début pour recevoir un rappel. Une journée entière n'a pas d'heure à rappeler."
            recurring={!!draft.recurrence && draft.recurrence !== "none"}
          />
          <Button className="w-full" onClick={submit} disabled={!draft.title.trim() || !draft.date || endInvalid}>
            Ajouter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
