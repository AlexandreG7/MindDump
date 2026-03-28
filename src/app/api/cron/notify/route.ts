import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/mail";

// This endpoint is called by the cron job to send notifications
// Protected by a secret token
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.NEXTAUTH_SECRET}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const now = new Date();
  let sent = 0;

  // Check todos with notifications
  const todos = await prisma.todo.findMany({
    where: {
      completed: false,
      notified: false,
      dueDate: { not: null },
      notifyBefore: { not: null },
    },
    include: { user: true },
  });

  for (const todo of todos) {
    if (!todo.dueDate || !todo.notifyBefore || !todo.user.email) continue;
    const notifyAt = new Date(
      todo.dueDate.getTime() - todo.notifyBefore * 60 * 1000
    );
    if (now >= notifyAt) {
      await sendNotificationEmail(
        todo.user.email,
        `Rappel: ${todo.title}`,
        `<h2>Rappel de tache</h2>
        <p><strong>${todo.title}</strong></p>
        ${todo.description ? `<p>${todo.description}</p>` : ""}
        <p>Echeance: ${todo.dueDate.toLocaleDateString("fr-FR")} a ${todo.dueDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
        <p><a href="${process.env.NEXTAUTH_URL}/todos">Voir mes taches</a></p>`
      );
      await prisma.todo.update({
        where: { id: todo.id },
        data: { notified: true },
      });
      sent++;
    }
  }

  // Check calendar events with notifications
  const events = await prisma.calendarEvent.findMany({
    where: {
      notified: false,
      notifyBefore: { not: null },
    },
    include: { user: true },
  });

  for (const event of events) {
    if (!event.notifyBefore || !event.user.email) continue;
    const notifyAt = new Date(
      event.date.getTime() - event.notifyBefore * 60 * 1000
    );
    if (now >= notifyAt) {
      await sendNotificationEmail(
        event.user.email,
        `Rappel: ${event.title}`,
        `<h2>Rappel d'evenement</h2>
        <p><strong>${event.title}</strong></p>
        ${event.description ? `<p>${event.description}</p>` : ""}
        <p>Date: ${event.date.toLocaleDateString("fr-FR")}${
          !event.allDay
            ? ` a ${event.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
            : ""
        }</p>
        <p><a href="${process.env.NEXTAUTH_URL}/calendar">Voir mon calendrier</a></p>`
      );
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { notified: true },
      });
      sent++;
    }
  }

  return NextResponse.json({ sent, checked: todos.length + events.length });
}
