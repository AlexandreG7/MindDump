import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

export type DueState = "late" | "today" | "soon" | "later";

/**
 * Échéance en langage courant : « Aujourd'hui · 18:00 », « Demain · 09:00 »,
 * « Hier », « Mer. 14 oct. ». Affichage seulement, aucune donnée modifiée.
 * `state` sert à teinter la pastille (en retard, aujourd'hui…).
 */
export function dueLabel(iso: string, now: Date = new Date()): { text: string; state: DueState } {
  const d = new Date(iso);
  const today = startOfDay(now);
  const time = format(d, "HH:mm");
  const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0);
  const withTime = (label: string) => (hasTime ? `${label} · ${time}` : label);

  if (isSameDay(d, now)) {
    return { text: withTime("Aujourd'hui"), state: hasTime && d < now ? "late" : "today" };
  }
  if (d < today) {
    if (isSameDay(d, addDays(today, -1))) return { text: withTime("Hier"), state: "late" };
    return { text: format(d, "EEE d MMM", { locale: fr }), state: "late" };
  }
  if (isSameDay(d, addDays(today, 1))) return { text: withTime("Demain"), state: "soon" };
  const days = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  return { text: withTime(format(d, "EEE d MMM", { locale: fr })), state: days <= 6 ? "soon" : "later" };
}
