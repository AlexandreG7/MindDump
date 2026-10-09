"use client";

import { Bell, BellOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  NO_REMINDER,
  REMINDER_OPTIONS,
  formatFireAt,
  isReminderPast,
  reminderFireAt,
  reminderLabel,
  reminderShort,
  valueToReminder,
} from "@/lib/reminderOptions";

/**
 * Menu de rappel partagé par les tâches et l'agenda : options fixes, jamais de
 * saisie libre. Les options dont l'heure est déjà passée sont grisées, l'heure
 * effective du rappel est rappelée dessous.
 *
 * `value` est le rappel retenu ; `wanted` celui que la personne voulait avant
 * un éventuel ajustement automatique (quand ils diffèrent, une phrase explique
 * pourquoi). Le composant ne décide rien : le parent règle `value`.
 */
export function ReminderField({
  id,
  dueIso,
  value,
  wanted,
  onChange,
  unavailableHint,
  recurring = false,
}: {
  id: string;
  /** Instant de l'échéance (ISO), null s'il n'y en a pas : le menu est alors désactivé. */
  dueIso: string | null;
  value: string;
  wanted: string;
  onChange: (value: string) => void;
  /** Phrase affichée quand le menu est désactivé faute d'échéance. */
  unavailableHint: string;
  /** Événement récurrent : chaque occurrence est rappelée, l'heure de départ n'est pas « passée ». */
  recurring?: boolean;
}) {
  const hasDue = !!dueIso;
  const now = Date.now();
  const checkPast = hasDue && !recurring;
  const known = REMINDER_OPTIONS.some((o) => o.value === value);
  const hintId = `${id}-aide`;

  const fireAt = hasDue ? reminderFireAt(dueIso, value) : null;
  const currentIsPast = checkPast && isReminderPast(dueIso, value, now);
  const adjusted = checkPast && value !== wanted && wanted !== NO_REMINDER;

  let status: string;
  if (!hasDue) status = unavailableHint;
  else if (value === NO_REMINDER) status = "Pas de rappel";
  else if (recurring)
    status =
      value === "0"
        ? "Chaque occurrence sera rappelée à l'heure."
        : `Chaque occurrence sera rappelée ${reminderShort(value)} avant.`;
  else if (fireAt !== null)
    status = currentIsPast ? `Rappel prévu ${formatFireAt(fireAt, now)} : déjà passé.` : `Rappel ${formatFireAt(fireAt, now)}`;
  else status = "";

  let note = "";
  if (adjusted) {
    const wantedShort = reminderShort(wanted);
    const wantedText = wanted === "0" ? "Le rappel à l'heure" : `Le rappel de ${wantedShort}`;
    const dueMs = new Date(dueIso!).getTime();
    note =
      value === NO_REMINDER
        ? dueMs <= now
          ? "L'échéance est déjà passée : il n'y a plus de rappel possible."
          : `${wantedText} serait déjà passé, l'échéance est dans moins d'une minute.`
        : `${wantedText} serait déjà passé : il est réglé sur ${value === "0" ? "l'heure de l'échéance" : `${reminderShort(value)} avant`}.`;
  }

  return (
    <div>
      <Label htmlFor={id}>Rappel</Label>
      <Select value={value} disabled={!hasDue} onValueChange={onChange}>
        <SelectTrigger id={id} aria-describedby={hintId}>
          {hasDue && value === NO_REMINDER ? (
            <BellOff className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <Bell className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="flex-1 text-left">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {REMINDER_OPTIONS.map((opt) => {
            const past = checkPast && opt.value !== NO_REMINDER && isReminderPast(dueIso, opt.value, now);
            return (
              <SelectItem key={opt.value} value={opt.value} disabled={past && opt.value !== value}>
                {opt.label}
                {past && <span className="text-muted-foreground"> (déjà passé)</span>}
              </SelectItem>
            );
          })}
          {/* Valeur d'avant le menu (ancienne saisie libre) : lisible tant qu'on n'y touche pas. */}
          {!known && (
            <SelectItem value={value}>
              {reminderLabel(valueToReminder(value))}
              {currentIsPast && <span className="text-muted-foreground"> (déjà passé)</span>}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      <div id={hintId} className="mt-1 space-y-0.5 text-xs text-muted-foreground" aria-live="polite">
        {note && <p>{note}</p>}
        <p>{status}</p>
      </div>
    </div>
  );
}
