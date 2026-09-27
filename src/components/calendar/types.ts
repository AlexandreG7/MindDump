export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endDate?: string | null;
  allDay: boolean;
  recurrence: string | null;
  color?: string | null;
  notifyBefore: number | null;
  subscriptionId?: string;
  subscriptionName?: string;
  /** Personnes du foyer concernées (profils du groupe de l'événement). */
  assigneeIds?: string[];
  /** Couleur affichée : celle de l'événement, sinon celle de sa première personne. */
  displayColor?: string | null;
}

export interface Subscription {
  id: string;
  name: string;
  url: string | null;
  color: string;
  enabled: boolean;
  groupId: string | null;
  groupName: string | null;
  isOwner: boolean;
}

export type ViewMode = "day" | "week" | "month" | "agenda" | "year";

export const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
  agenda: "Liste",
  year: "Année",
};

export function isViewMode(value: unknown): value is ViewMode {
  return typeof value === "string" && value in VIEW_LABELS;
}
