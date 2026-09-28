import { occurrencesBetween } from "./recurrence";

export type EventRow = {
  id: string;
  date: Date;
  endDate: Date | null;
  recurrence: string | null;
};

/**
 * Événements qui touchent [from, to], récurrences développées. Une occurrence
 * autre que la première porte l'id `<id>_<date iso>` (l'interface agit toujours
 * sur l'événement source).
 */
export function expandRecurrences<T extends EventRow>(events: T[], from: Date, to: Date) {
  const result: T[] = [];
  for (const event of events) {
    const recurrence = event.recurrence && event.recurrence !== "none" ? event.recurrence : null;
    for (const occ of occurrencesBetween(event.date, event.endDate, recurrence, from, to)) {
      result.push({
        ...event,
        id: occ.date.getTime() === event.date.getTime() ? event.id : `${event.id}_${occ.date.toISOString()}`,
        date: occ.date,
        endDate: occ.endDate,
      });
    }
  }
  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}
