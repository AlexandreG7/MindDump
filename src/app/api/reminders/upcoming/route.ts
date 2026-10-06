import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  listTodoCandidates,
  listEventCandidates,
  recipientsForTodo,
  recipientsForEvent,
  todoReminderContent,
  eventReminderContent,
  type Recipient,
} from "@/lib/reminders";

export const dynamic = "force-dynamic";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// iOS plafonne à 64 notifications locales en attente par app.
const MAX_REMINDERS = 60;

type UpcomingReminder = {
  key: string;
  kind: "todo" | "event";
  itemId: string;
  title: string;
  body: string;
  fireAt: string;
  url: string;
};

/**
 * Rappels des 30 prochains jours pour l'app mobile, afin de programmer des
 * notifications locales (@capacitor/local-notifications, sans APNs ni FCM).
 * Même règle que le cron (src/lib/reminders.ts) : un utilisateur ne voit que
 * les rappels qui le concernent (recipientsFor), et seulement s'il n'a pas
 * désactivé les rappels (`User.notifyReminders`).
 */
export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorized();

  const now = new Date();
  const generatedAt = now.toISOString();

  const prefs = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { notifyReminders: true },
  });
  if (prefs?.notifyReminders === false) {
    return NextResponse.json({ reminders: [], generatedAt });
  }

  const windowEnd = new Date(now.getTime() + WINDOW_MS);
  const groupMembers = new Map<string, Recipient[]>();

  const results: Array<UpcomingReminder & { fireAtDate: Date }> = [];

  const todoCandidates = await listTodoCandidates(windowEnd, sessionUser.id);
  for (const { todo, fireAt } of todoCandidates) {
    if (fireAt < now) continue;
    const recipients = await recipientsForTodo(todo, groupMembers);
    if (!recipients.some((r) => r.id === sessionUser.id)) continue;
    const content = todoReminderContent(todo);
    results.push({
      key: content.key,
      kind: "todo",
      itemId: todo.id,
      title: content.title,
      body: content.body,
      url: content.url,
      fireAt: fireAt.toISOString(),
      fireAtDate: fireAt,
    });
  }

  // allOccurrences = true : une série récurrente doit proposer toutes ses
  // occurrences des 30 prochains jours, pas seulement la suivante (le cron,
  // lui, n'a besoin que de la prochaine à chaque passage).
  const eventCandidates = await listEventCandidates(now, windowEnd, true, sessionUser.id);
  for (const { event, occurrenceAt, fireAt } of eventCandidates) {
    if (fireAt < now) continue;
    const recipients = await recipientsForEvent(event, groupMembers);
    if (!recipients.some((r) => r.id === sessionUser.id)) continue;
    const content = eventReminderContent(event, occurrenceAt);
    results.push({
      key: content.key,
      kind: "event",
      itemId: event.id,
      title: content.title,
      body: content.body,
      url: content.url,
      fireAt: fireAt.toISOString(),
      fireAtDate: fireAt,
    });
  }

  results.sort((a, b) => a.fireAtDate.getTime() - b.fireAtDate.getTime());
  const reminders = results
    .slice(0, MAX_REMINDERS)
    .map(({ fireAtDate, ...reminder }) => reminder);

  return NextResponse.json({ reminders, generatedAt });
}
