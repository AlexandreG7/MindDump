import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/mail";
import { nextOccurrence } from "@/lib/recurrence";

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

// Une occurrence récurrente reste rappelable un moment après son heure, pour
// ne pas la manquer entre deux passages du cron (toutes les 5 minutes).
const OCCURRENCE_GRACE_MS = 60 * 60 * 1000;

/**
 * Destinataires d'un rappel : tous les membres du groupe auquel l'élément est
 * rattaché — ceux qui le voient sont ceux qu'il faut prévenir. Un élément sans
 * groupe ne prévient que son créateur.
 */
async function recipientsFor(
  creatorEmail: string | null,
  groupId: string | null,
  cache: Map<string, string[]>
): Promise<string[]> {
  if (!groupId) return creatorEmail ? [creatorEmail] : [];

  let emails = cache.get(groupId);
  if (!emails) {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { user: { select: { email: true } } },
    });
    emails = members.flatMap((m) => (m.user.email ? [m.user.email] : []));
    cache.set(groupId, emails);
  }

  const all = creatorEmail ? [creatorEmail, ...emails] : emails;
  return Array.from(new Set(all));
}

/** Envoie à chaque destinataire ; renvoie le nombre d'envois réussis. */
async function sendToAll(recipients: string[], subject: string, html: string) {
  let ok = 0;
  for (const to of recipients) {
    try {
      await sendNotificationEmail(to, subject, html);
      ok++;
    } catch (error) {
      console.error(`[cron/notify] Échec d'envoi à ${to}:`, error);
    }
  }
  return ok;
}

function sharedLine(groupName: string | undefined, creatorName: string | null) {
  if (!groupName) return "";
  const by = creatorName ? `, ajouté par ${escapeHtml(creatorName)}` : "";
  return `<p style="color:#666">Partagé avec « ${escapeHtml(groupName)} »${by}.</p>`;
}

/** Première occurrence d'une série encore à rappeler, ou null. */
function upcomingOccurrence(
  start: Date,
  recurrence: string,
  alreadyNotified: Date | null,
  now: Date
): Date | null {
  const floor = now.getTime() - OCCURRENCE_GRACE_MS;
  let current: Date | null = new Date(start);
  let safety = 5000;
  while (current && safety-- > 0) {
    const afterNotified = !alreadyNotified || current > alreadyNotified;
    if (afterNotified && current.getTime() >= floor) return current;
    current = nextOccurrence(current, recurrence);
  }
  return null;
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
  const groupEmails = new Map<string, string[]>();
  let sent = 0;

  // Check todos with notifications
  const todos = await prisma.todo.findMany({
    where: {
      completed: false,
      notified: false,
      dueDate: { not: null },
      notifyBefore: { not: null },
    },
    include: { user: true, group: { select: { name: true } } },
  });

  for (const todo of todos) {
    if (!todo.dueDate || !todo.notifyBefore) continue;
    const notifyAt = new Date(
      todo.dueDate.getTime() - todo.notifyBefore * 60 * 1000
    );
    if (now < notifyAt) continue;

    const recipients = await recipientsFor(todo.user.email, todo.groupId, groupEmails);
    const ok = await sendToAll(
      recipients,
      `Rappel: ${todo.title}`,
      `<h2>Rappel de tache</h2>
        <p><strong>${escapeHtml(todo.title)}</strong></p>
        ${todo.description ? `<p>${escapeHtml(todo.description)}</p>` : ""}
        <p>Echeance: ${todo.dueDate.toLocaleDateString("fr-FR")} a ${todo.dueDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
        ${recipients.length > 1 ? sharedLine(todo.group?.name, todo.user.name) : ""}
        <p><a href="${process.env.NEXTAUTH_URL}/todos">Voir les taches</a></p>`
    );
    // Si tout a échoué (SMTP indisponible), on retentera au prochain passage.
    if (ok === 0 && recipients.length > 0) continue;
    await prisma.todo.update({
      where: { id: todo.id },
      data: { notified: true },
    });
    sent += ok;
  }

  // Check calendar events with notifications. Un événement récurrent n'est
  // jamais marqué `notified` : chaque occurrence a son propre rappel.
  const events = await prisma.calendarEvent.findMany({
    where: {
      notifyBefore: { not: null },
      OR: [{ notified: false }, { recurrence: { not: null } }],
    },
    include: { user: true, group: { select: { name: true } } },
  });

  for (const event of events) {
    if (!event.notifyBefore) continue;

    const occurrence = event.recurrence
      ? upcomingOccurrence(event.date, event.recurrence, event.notifiedOccurrence, now)
      : event.date;
    if (!occurrence) continue;

    const notifyAt = new Date(occurrence.getTime() - event.notifyBefore * 60 * 1000);
    if (now < notifyAt) continue;

    const recipients = await recipientsFor(event.user.email, event.groupId, groupEmails);
    const ok = await sendToAll(
      recipients,
      `Rappel: ${event.title}`,
      `<h2>Rappel d'evenement</h2>
        <p><strong>${escapeHtml(event.title)}</strong></p>
        ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
        <p>Date: ${occurrence.toLocaleDateString("fr-FR")}${
          !event.allDay
            ? ` a ${occurrence.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
            : ""
        }</p>
        ${recipients.length > 1 ? sharedLine(event.group?.name, event.user.name) : ""}
        <p><a href="${process.env.NEXTAUTH_URL}/calendar">Voir le calendrier</a></p>`
    );
    if (ok === 0 && recipients.length > 0) continue;
    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: event.recurrence
        ? { notifiedOccurrence: occurrence }
        : { notified: true },
    });
    sent += ok;
  }

  return NextResponse.json({ sent, checked: todos.length + events.length });
}
