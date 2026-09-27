"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_COLORS, RECURRENCE_OPTIONS } from "@/lib/recurrence";
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
  notifyBefore: "",
  assigneeIds: [],
});

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

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

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
            <Label>Titre</Label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </div>
          <div>
            <Label>Description (optionnel)</Label>
            <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </div>
            <div>
              <Label>Début</Label>
              <Input
                type="time"
                value={draft.time}
                onChange={(e) => setDraft({ ...draft, time: e.target.value, endTime: e.target.value ? draft.endTime : "" })}
              />
            </div>
            <div>
              <Label>Fin</Label>
              <Input
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
            <Label>Récurrence</Label>
            <Select value={draft.recurrence} onValueChange={(v) => setDraft({ ...draft, recurrence: v })}>
              <SelectTrigger>
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
          <div>
            <Label>Rappel (minutes avant)</Label>
            <Input
              type="number"
              value={draft.notifyBefore}
              onChange={(e) => setDraft({ ...draft, notifyBefore: e.target.value })}
              placeholder="30"
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={!draft.title.trim() || !draft.date || endInvalid}>
            Ajouter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
