"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_COLORS, RECURRENCE_OPTIONS } from "@/lib/recurrence";
import { ReminderField } from "@/components/reminders/ReminderField";
import { DEFAULT_REMINDER, NO_REMINDER, settleReminder } from "@/lib/reminderOptions";
import { AssigneePicker } from "@/components/profiles/Assignees";
import type { FamilyProfile } from "@/components/profiles/ProfileAvatar";

export interface EventDraft {
  title: string;
  description: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm, vide = journée entière
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
  endTime: "",
  recurrence: "",
  color: "",
  notifyBefore: NO_REMINDER,
  assigneeIds: [],
});

/** Instant de début (ISO) d'un brouillon, null pour une journée entière. */
const startOf = (date: string, time: string) => {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
      endTime: time ? draft.endTime : "",
      notifyBefore: time ? settleReminder(startOf(date, time), want, Date.now()) : NO_REMINDER,
    });
  };

  const endInvalid = !!draft.time && !!draft.endTime && draft.endTime <= draft.time;

  const submit = async () => {
    if (!draft.title.trim() || !draft.date || endInvalid) return;
    await onSubmit(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-1">
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
            {endInvalid
              ? "L'heure de fin doit suivre l'heure de début."
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
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, color: "" })}
                title="Par défaut"
                className={`w-6 h-6 rounded-full border border-border bg-primary/10 transition-transform ${
                  !draft.color ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-110"
                }`}
              />
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c.value })}
                  title={c.label}
                  style={{ backgroundColor: c.value }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    draft.color === c.value ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-110"
                  }`}
                />
              ))}
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
