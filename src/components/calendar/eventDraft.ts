import { joinDue, splitDue } from "@/lib/todoDue";
import { NO_REMINDER, reminderToValue } from "@/lib/reminderOptions";
import type { CalendarEvent } from "./types";
import { eventDays, eventEnd } from "./utils";

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

/** Brouillon d'un événement existant, pour le formulaire de modification. */
export function draftFromEvent(e: CalendarEvent): EventDraft {
  const { first, last } = eventDays(e);
  const base = {
    title: e.title,
    description: e.description ?? "",
    date: first,
    endDate: last > first ? last : "",
    recurrence: e.recurrence ?? "",
    color: e.color ?? "",
    notifyBefore: reminderToValue(e.notifyBefore),
    assigneeIds: e.assigneeIds ?? [],
  };
  if (e.allDay) return { ...base, time: "", endTime: "" };
  const { time } = splitDue(e.date);
  const endTime = e.endDate ? splitDue(eventEnd(e).toISOString()).time : "";
  // Une fin le même jour, avant ou à l'heure du début, n'est pas saisissable.
  return { ...base, time, endTime: !base.endDate && endTime <= time ? "" : endTime };
}

/** Instant de début (ISO) d'un brouillon, null pour une journée entière. */
export const startOf = (date: string, time: string) => {
  if (!date || !time) return null;
  return joinDue(date, time);
};

