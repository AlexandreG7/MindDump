import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendReminder, type Recipient } from "@/lib/notify";
import {
  listTodoCandidates,
  listEventCandidates,
  recipientsForTodo,
  recipientsForEvent,
  todoReminderContent,
  eventReminderContent,
  formatDate,
  formatTime,
  TODO_REMINDER_WHERE,
  EVENT_REMINDER_WHERE,
} from "@/lib/reminders";

// Comparaison à temps constant pour éviter les fuites temporelles sur le secret.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Les titres viennent de n'importe quel membre du groupe et partent dans la
// boîte des autres : on ne les injecte jamais tels quels dans le HTML.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sharedLine(groupName: string | undefined, creatorName: string | null) {
  if (!groupName) return "";
  const by = creatorName ? `, ajouté par ${escapeHtml(creatorName)}` : "";
  return `<p style="color:#666">Partagé avec « ${escapeHtml(groupName)} »${by}.</p>`;
}

// This endpoint is called by the cron job to send notifications.
// Protégé par un secret dédié CRON_SECRET (retombe sur NEXTAUTH_SECRET pour
// compatibilité si CRON_SECRET n'est pas encore défini).
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!secret || !safeEqual(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const now = new Date();
  const groupMembers = new Map<string, Recipient[]>();
  let sent = 0;

  // Check todos with notifications
  const todoCandidates = (await listTodoCandidates(now)).filter((c) => now >= c.fireAt);

  for (const { todo } of todoCandidates) {
    const recipients = await recipientsForTodo(todo, groupMembers);
    const content = todoReminderContent(todo);
    const date = formatDate(todo.dueDate!);
    const time = formatTime(todo.dueDate!);
    const { attempted, delivered } = await sendReminder(recipients, {
      email: {
        subject: `Rappel: ${todo.title}`,
        html: `<h2>Rappel de tache</h2>
        <p><strong>${escapeHtml(todo.title)}</strong></p>
        ${todo.description ? `<p>${escapeHtml(todo.description)}</p>` : ""}
        <p>Echeance: ${date} a ${time}</p>
        ${recipients.length > 1 ? sharedLine(todo.group?.name, todo.user.name) : ""}
        <p><a href="${process.env.NEXTAUTH_URL}${content.url}">Voir les taches</a></p>`,
      },
      push: {
        title: content.title,
        body: content.body,
        url: content.url,
        tag: content.key,
      },
    });
    // Si tout a échoué (SMTP ou service push indisponible), on retentera au
    // prochain passage.
    if (attempted > 0 && delivered === 0) continue;
    await prisma.todo.update({
      where: { id: todo.id },
      data: { notified: true },
    });
    sent += delivered;
  }

  // Check calendar events with notifications. Un événement récurrent n'est
  // jamais marqué `notified` : chaque occurrence a son propre rappel.
  const eventCandidates = (await listEventCandidates(now, now, false)).filter(
    (c) => now >= c.fireAt
  );

  for (const { event, occurrenceAt } of eventCandidates) {
    const recipients = await recipientsForEvent(event, groupMembers);
    const content = eventReminderContent(event, occurrenceAt);
    const { attempted, delivered } = await sendReminder(recipients, {
      email: {
        subject: `Rappel: ${event.title}`,
        html: `<h2>Rappel d'evenement</h2>
        <p><strong>${escapeHtml(event.title)}</strong></p>
        ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
        <p>Date: ${formatDate(occurrenceAt)}${!event.allDay ? ` a ${formatTime(occurrenceAt)}` : ""}</p>
        ${recipients.length > 1 ? sharedLine(event.group?.name, event.user.name) : ""}
        <p><a href="${process.env.NEXTAUTH_URL}${content.url}">Voir le calendrier</a></p>`,
      },
      push: {
        title: content.title,
        body: content.body,
        url: content.url,
        tag: content.key,
      },
    });
    if (attempted > 0 && delivered === 0) continue;
    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: event.recurrence ? { notifiedOccurrence: occurrenceAt } : { notified: true },
    });
    sent += delivered;
  }

  // Diagnostic : nombre de tâches/événements examinés, dus ou pas (comme
  // avant le partage de cette logique avec src/lib/reminders.ts).
  const checked =
    (await prisma.todo.count({ where: TODO_REMINDER_WHERE })) +
    (await prisma.calendarEvent.count({ where: EVENT_REMINDER_WHERE }));

  return NextResponse.json({ sent, checked });
}
