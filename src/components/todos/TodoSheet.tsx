"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Bell, BellOff, Calendar, Check, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssigneePicker } from "@/components/profiles/Assignees";
import type { FamilyProfile } from "@/components/profiles/ProfileAvatar";
import { RECURRENCE_OPTIONS } from "@/lib/recurrence";
import {
  DEFAULT_DUE_TIME,
  DEFAULT_REMINDER,
  NO_REMINDER,
  REMINDER_OPTIONS,
  joinDue,
  reminderLabel,
  reminderToValue,
  splitDue,
  valueToReminder,
} from "@/lib/todoDue";

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  priority: "URGENT" | "PLANNED";
  dueDate: string | null;
  completed: boolean;
  recurrence: string | null;
  notifyBefore: number | null;
  assigneeIds?: string[];
  userId?: string;
}

/** Ce que la fiche envoie à l'API (POST ou PATCH). */
export interface TodoPayload {
  title: string;
  description: string | null;
  priority: "URGENT" | "PLANNED";
  dueDate: string | null;
  recurrence: string | null;
  notifyBefore: number | null;
  assigneeIds: string[];
}

interface Draft {
  title: string;
  description: string;
  priority: "URGENT" | "PLANNED";
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  recurrence: string; // "" = aucune
  reminder: string; // valeur du sélecteur de rappel
  assigneeIds: string[];
}

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  priority: "URGENT",
  date: "",
  time: "",
  recurrence: "",
  reminder: NO_REMINDER,
  assigneeIds: [],
});

function draftFrom(todo: Todo): Draft {
  const { date, time } = splitDue(todo.dueDate);
  return {
    title: todo.title,
    description: todo.description ?? "",
    priority: todo.priority,
    date,
    time,
    recurrence: todo.recurrence ?? "",
    reminder: reminderToValue(todo.notifyBefore),
    assigneeIds: todo.assigneeIds ?? [],
  };
}

/**
 * Fiche d'une tâche : création (todo = null) ou consultation et modification.
 * Sheet en bas de l'écran sur téléphone, dialogue centré sur ordinateur.
 */
export function TodoSheet({
  open,
  onOpenChange,
  todo,
  profiles,
  byId,
  onSubmit,
  onToggle,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = nouvelle tâche. */
  todo: Todo | null;
  /** Personnes qu'on peut assigner dans le groupe courant. */
  profiles: FamilyProfile[];
  /** Toutes les personnes connues, pour retrouver l'auteur. */
  byId: Map<string, FamilyProfile>;
  /** Renvoie true si l'enregistrement a réussi (la fiche se ferme alors). */
  onSubmit: (payload: TodoPayload) => Promise<boolean>;
  onToggle?: (todo: Todo) => void;
  onDelete?: (todo: Todo) => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const todoId = todo?.id ?? null;

  // Rechargé à l'ouverture et quand on passe à une autre tâche, pas à chaque
  // rafraîchissement de la liste (on écraserait la saisie en cours).
  useEffect(() => {
    if (open) setDraft(todo ? draftFrom(todo) : emptyDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, todoId]);

  const hasDue = !!draft.date;
  const creator = todo?.userId
    ? Array.from(byId.values()).find((p) => p.userId === todo.userId)
    : undefined;

  const setDate = (date: string) =>
    setDraft((d) => {
      if (!date) return { ...d, date: "", time: "", recurrence: "", reminder: NO_REMINDER };
      const first = !d.date;
      return {
        ...d,
        date,
        time: d.time || DEFAULT_DUE_TIME,
        // Première échéance : on propose un rappel plutôt que de laisser un
        // champ vide qui ne déclenche rien.
        reminder: first && d.reminder === NO_REMINDER ? DEFAULT_REMINDER : d.reminder,
      };
    });

  const submit = async () => {
    if (!draft.title.trim() || saving) return;
    setSaving(true);
    const dueDate = joinDue(draft.date, draft.time);
    const ok = await onSubmit({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      priority: draft.priority,
      dueDate,
      recurrence: dueDate ? draft.recurrence || null : null,
      notifyBefore: dueDate ? valueToReminder(draft.reminder) : null,
      assigneeIds: draft.assigneeIds,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92dvh] flex-col gap-0 p-0 outline-none max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom"
        aria-describedby={undefined}
        // En consultation, pas de focus automatique : sur téléphone il ouvrirait le clavier.
        onOpenAutoFocus={todo ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader className="px-6 pt-6 pb-3 pr-12">
          <DialogTitle>{todo ? "Ta tâche" : "Ajouter une tâche"}</DialogTitle>
          {todo && (
            <p className="text-xs text-muted-foreground">
              {creator ? `Créée par ${creator.name}` : "Créée dans ton foyer"}
              {" · "}
              {todo.completed ? "terminée" : "à faire"}
            </p>
          )}
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
            <div>
              <Label htmlFor="todo-title">Titre</Label>
              <Input
                id="todo-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Qu'est-ce qu'il faut faire ?"
                autoFocus={!todo}
              />
            </div>
            <div>
              <Label htmlFor="todo-description">Description (optionnel)</Label>
              <Textarea
                id="todo-description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Détails…"
              />
            </div>
            <div>
              <Label id="todo-priority">Priorité</Label>
              <div className="flex gap-2 mt-1" role="group" aria-labelledby="todo-priority">
                <Button
                  type="button"
                  variant={draft.priority === "URGENT" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={draft.priority === "URGENT"}
                  onClick={() => setDraft({ ...draft, priority: "URGENT" })}
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Urgent
                </Button>
                <Button
                  type="button"
                  variant={draft.priority === "PLANNED" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={draft.priority === "PLANNED"}
                  onClick={() => setDraft({ ...draft, priority: "PLANNED" })}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Planifié
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="todo-due-date">Échéance</Label>
                {hasDue && (
                  <button
                    type="button"
                    onClick={() => setDate("")}
                    aria-label="Retirer l'échéance"
                    className="-my-1 flex h-7 w-7 touch:h-9 touch:w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <Input
                  id="todo-due-date"
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="Date d'échéance"
                />
                <Input
                  id="todo-due-time"
                  type="time"
                  value={draft.time}
                  disabled={!hasDue}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  aria-label="Heure d'échéance"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="todo-reminder">Rappel</Label>
              <Select
                value={draft.reminder}
                disabled={!hasDue}
                onValueChange={(v) => setDraft({ ...draft, reminder: v })}
              >
                <SelectTrigger id="todo-reminder">
                  {hasDue && draft.reminder === NO_REMINDER ? (
                    <BellOff className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <Bell className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="flex-1 text-left">
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  {!REMINDER_OPTIONS.some((o) => o.value === draft.reminder) && (
                    <SelectItem value={draft.reminder}>{reminderLabel(valueToReminder(draft.reminder))}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {!hasDue
                  ? "Ajoute une échéance pour recevoir un rappel."
                  : draft.reminder === NO_REMINDER
                    ? "Tu ne recevras pas de notification pour cette tâche."
                    : "Tu recevras une notification sur ton téléphone."}
              </p>
            </div>

            <div>
              <Label htmlFor="todo-recurrence">Récurrence</Label>
              <Select
                value={draft.recurrence || "none"}
                disabled={!hasDue}
                onValueChange={(v) => setDraft({ ...draft, recurrence: v === "none" ? "" : v })}
              >
                <SelectTrigger id="todo-recurrence">
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
              {(!hasDue || draft.recurrence) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {!hasDue
                    ? "Ajoute une échéance pour répéter la tâche."
                    : "Une nouvelle occurrence sera créée automatiquement quand tu coches la tâche."}
                </p>
              )}
            </div>

            {profiles.length > 0 && (
              <div className="space-y-1.5">
                <Label>Pour qui ?</Label>
                <AssigneePicker
                  profiles={profiles}
                  value={draft.assigneeIds}
                  onChange={(assigneeIds) => setDraft({ ...draft, assigneeIds })}
                />
                {draft.assigneeIds.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sans personne choisie, la tâche concerne tout le foyer.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t bg-background px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:rounded-none">
            {todo && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Supprimer la tâche"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(todo);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {todo && onToggle && (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  onOpenChange(false);
                  onToggle(todo);
                }}
              >
                {todo.completed ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Rouvrir
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    Terminée
                  </>
                )}
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={!draft.title.trim() || saving}>
              {todo ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
