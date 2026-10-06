import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { occurrencesBetween } from "./recurrence";
import { recipientsFor, type Recipient } from "./notify";

export type { Recipient };

/**
 * Règle unique « quels rappels, à quelle heure, pour qui », partagée par le
 * cron (e-mail + push web, src/app/api/cron/notify) et par la route des
 * rappels locaux de l'app mobile (src/app/api/reminders/upcoming). Ne pas
 * dupliquer cette logique : un changement ici vaut pour les deux.
 */

export const TIME_ZONE = "Europe/Paris";
export const formatDate = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: TIME_ZONE });
export const formatTime = (d: Date) =>
  d.toLocaleTimeString("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
/** AAAA-MM-JJ à l'heure de Paris, pour le lien /calendar?view=day&date=… */
export const dayParam = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TIME_ZONE });

// Une occurrence récurrente reste rappelable un moment après son heure, pour
// ne pas la manquer entre deux passages du cron (toutes les 5 minutes), ni
// entre deux rafraîchissements de l'app mobile.
export const OCCURRENCE_GRACE_MS = 60 * 60 * 1000;

const USER_SELECT = { id: true, email: true, notifyEmail: true, name: true } as const;

/** Clauses `where` des requêtes ci-dessous, exposées pour le diagnostic du cron
 * (compte de ce qui a été examiné, indépendamment de ce qui était dû). */
export const TODO_REMINDER_WHERE: Prisma.TodoWhereInput = {
  completed: false,
  notified: false,
  dueDate: { not: null },
  notifyBefore: { not: null },
};

export const EVENT_REMINDER_WHERE: Prisma.CalendarEventWhereInput = {
  notifyBefore: { not: null },
  OR: [{ notified: false }, { recurrence: { not: null } }],
};

/**
 * Pré-filtre SQL pour un utilisateur donné : créateur de l'élément, ou membre
 * actuel du groupe auquel il est rattaché. Sur-ensemble de `recipientsFor`
 * (créateur + membres du groupe, éventuellement restreints aux personnes
 * assignées) : la règle des destinataires reste appliquée ensuite par
 * l'appelant, ce filtre ne fait qu'éviter de charger les éléments des autres.
 * Le créateur est toujours inclus, même s'il a quitté le groupe (ADR 0001).
 */
function visibleTo(userId: string) {
  return [{ userId }, { group: { members: { some: { userId } } } }];
}

type TodoForReminder = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  notifyBefore: number | null;
  groupId: string | null;
  user: Recipient & { name: string | null };
  group: { name: string } | null;
  assignees: { profile: { userId: string | null } }[];
};

type EventForReminder = {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  allDay: boolean;
  recurrence: string | null;
  notifyBefore: number | null;
  notifiedOccurrence: Date | null;
  groupId: string | null;
  user: Recipient & { name: string | null };
  group: { name: string } | null;
  assignees: { profile: { userId: string | null } }[];
};

export type TodoReminderCandidate = {
  kind: "todo";
  todo: TodoForReminder;
  fireAt: Date;
};

export type EventReminderCandidate = {
  kind: "event";
  event: EventForReminder;
  occurrenceAt: Date;
  fireAt: Date;
};

/**
 * Tâches non terminées, pas encore notifiées, dont l'échéance tombe un jour.
 * `windowEnd` borne le rappel le plus tardif renvoyé (`fireAt <= windowEnd`) ;
 * à l'appelant de filtrer la borne basse (le cron veut `fireAt <= now`, la
 * route des rappels locaux veut `fireAt >= now`). `forUserId` : voir `visibleTo`
 * (omis = tous les utilisateurs, comme le cron).
 */
export async function listTodoCandidates(
  windowEnd: Date,
  forUserId?: string
): Promise<TodoReminderCandidate[]> {
  const todos = await prisma.todo.findMany({
    where: forUserId ? { AND: [TODO_REMINDER_WHERE, { OR: visibleTo(forUserId) }] } : TODO_REMINDER_WHERE,
    include: {
      user: { select: USER_SELECT },
      group: { select: { name: true } },
      assignees: { select: { profile: { select: { userId: true } } } },
    },
  });

  const candidates: TodoReminderCandidate[] = [];
  for (const todo of todos) {
    if (!todo.dueDate || !todo.notifyBefore) continue;
    const fireAt = new Date(todo.dueDate.getTime() - todo.notifyBefore * 60 * 1000);
    if (fireAt > windowEnd) continue;
    candidates.push({ kind: "todo", todo, fireAt });
  }
  return candidates;
}

/**
 * Première occurrence d'une série encore à rappeler (pas déjà notifiée, pas
 * passée depuis plus d'OCCURRENCE_GRACE_MS), si son rappel est dû d'ici
 * `horizon` ; sinon null. Calculée depuis la date d'origine (occurrencesBetween) :
 * un événement du 31 ne glisse pas au 3 du mois suivant, et une série ancienne
 * est rattrapée d'un saut.
 */
function firstUpcomingOccurrence(
  event: EventForReminder,
  now: Date,
  horizon: Date
): { date: Date; endDate: Date | null } | null {
  let from = now.getTime() - OCCURRENCE_GRACE_MS;
  if (event.notifiedOccurrence) from = Math.max(from, event.notifiedOccurrence.getTime() + 1);
  const [first] = occurrencesBetween(event.date, null, event.recurrence!, new Date(from), horizon);
  return first ?? null;
}

/**
 * Toutes les occurrences d'une série dont le rappel tombe dans
 * `[now - grâce, windowEnd]`, à partir de la dernière déjà notifiée.
 */
function upcomingOccurrencesInWindow(
  event: EventForReminder,
  now: Date,
  windowEnd: Date
): Array<{ date: Date; endDate: Date | null }> {
  const notifyOffsetMs = event.notifyBefore! * 60 * 1000;
  let from = now.getTime() - OCCURRENCE_GRACE_MS;
  if (event.notifiedOccurrence) from = Math.max(from, event.notifiedOccurrence.getTime() + 1);
  const occurrenceHorizon = new Date(windowEnd.getTime() + notifyOffsetMs);
  return occurrencesBetween(event.date, null, event.recurrence!, new Date(from), occurrenceHorizon);
}

/**
 * Événements avec rappel dont l'occurrence (unique, ou la première d'une
 * série) tombe avant `windowEnd`. Même borne basse que `listTodoCandidates` :
 * l'appelant filtre `fireAt` selon son usage (cron vs rappels locaux).
 *
 * `allOccurrences` : false (défaut, comportement du cron) ne renvoie que la
 * prochaine occurrence de chaque série ; true (rappels locaux) renvoie toutes
 * celles dues dans la fenêtre, pour programmer plusieurs notifications.
 *
 * `forUserId` : ne charge que les éléments que cet utilisateur peut recevoir
 * (voir `visibleTo`) ; omis, charge tout (cron).
 */
export async function listEventCandidates(
  now: Date,
  windowEnd: Date,
  allOccurrences = false,
  forUserId?: string
): Promise<EventReminderCandidate[]> {
  const events = await prisma.calendarEvent.findMany({
    where: forUserId ? { AND: [EVENT_REMINDER_WHERE, { OR: visibleTo(forUserId) }] } : EVENT_REMINDER_WHERE,
    include: {
      user: { select: USER_SELECT },
      group: { select: { name: true } },
      assignees: { select: { profile: { select: { userId: true } } } },
    },
  });

  const candidates: EventReminderCandidate[] = [];
  for (const event of events) {
    if (!event.notifyBefore) continue;

    if (!event.recurrence) {
      const fireAt = new Date(event.date.getTime() - event.notifyBefore * 60 * 1000);
      if (fireAt > windowEnd) continue;
      candidates.push({ kind: "event", event, occurrenceAt: event.date, fireAt });
      continue;
    }

    const occurrences = allOccurrences
      ? upcomingOccurrencesInWindow(event, now, windowEnd)
      : (() => {
          const horizon = new Date(windowEnd.getTime() + event.notifyBefore! * 60 * 1000);
          const first = firstUpcomingOccurrence(event, now, horizon);
          return first ? [first] : [];
        })();

    for (const occ of occurrences) {
      const fireAt = new Date(occ.date.getTime() - event.notifyBefore * 60 * 1000);
      if (fireAt > windowEnd) continue;
      candidates.push({ kind: "event", event, occurrenceAt: occ.date, fireAt });
    }
  }
  return candidates;
}

/** Destinataires d'une tâche : voir `recipientsFor` (src/lib/notify.ts). */
export function recipientsForTodo(
  todo: TodoForReminder,
  cache: Map<string, Recipient[]>
): Promise<Recipient[]> {
  return recipientsFor(
    todo.user,
    todo.groupId,
    cache,
    todo.assignees.map((a) => a.profile.userId)
  );
}

/** Destinataires d'un événement : voir `recipientsFor` (src/lib/notify.ts). */
export function recipientsForEvent(
  event: EventForReminder,
  cache: Map<string, Recipient[]>
): Promise<Recipient[]> {
  return recipientsFor(
    event.user,
    event.groupId,
    cache,
    event.assignees.map((a) => a.profile.userId)
  );
}

/** Contenu (titre, texte, lien, clé stable) du rappel d'une tâche. */
export function todoReminderContent(todo: TodoForReminder) {
  const date = todo.dueDate ? formatDate(todo.dueDate) : "";
  const time = todo.dueDate ? formatTime(todo.dueDate) : "";
  return {
    key: `todo-${todo.id}`,
    title: todo.title,
    body: `Échéance le ${date} à ${time}`,
    url: `/todos?task=${todo.id}`,
  };
}

/** Contenu (titre, texte, lien, clé stable) du rappel d'une occurrence d'événement. */
export function eventReminderContent(event: EventForReminder, occurrenceAt: Date) {
  const dayLink = `/calendar?view=day&date=${dayParam(occurrenceAt)}`;
  const when = event.allDay
    ? `Le ${formatDate(occurrenceAt)}`
    : `Le ${formatDate(occurrenceAt)} à ${formatTime(occurrenceAt)}`;
  return {
    key: `event-${event.id}-${occurrenceAt.getTime()}`,
    title: event.title,
    body: when,
    url: dayLink,
  };
}
