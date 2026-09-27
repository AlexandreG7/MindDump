import { prisma } from "./prisma";
import { sendNotificationEmail } from "./mail";
import { sendPushToUser, type PushMessage } from "./push";

/**
 * Envoi des rappels (src/app/api/cron/notify) sur chaque canal : e-mail si
 * l'utilisateur ne l'a pas désactivé, push sur chacun de ses appareils abonnés.
 */

export type Recipient = { id: string; email: string | null; notifyEmail: boolean };

export type Reminder = {
  email: { subject: string; html: string };
  push: PushMessage;
};

const RECIPIENT_SELECT = { id: true, email: true, notifyEmail: true } as const;

/**
 * Destinataires d'un rappel : tous les membres du groupe auquel l'élément est
 * rattaché — ceux qui le voient sont ceux qu'il faut prévenir. Un élément sans
 * groupe ne prévient que son créateur.
 */
export async function recipientsFor(
  creator: Recipient,
  groupId: string | null,
  cache: Map<string, Recipient[]>
): Promise<Recipient[]> {
  if (!groupId) return [creator];

  let members = cache.get(groupId);
  if (!members) {
    const rows = await prisma.groupMember.findMany({
      where: { groupId },
      select: { user: { select: RECIPIENT_SELECT } },
    });
    members = rows.map((m) => m.user);
    cache.set(groupId, members);
  }

  const byId = new Map([creator, ...members].map((r) => [r.id, r]));
  return Array.from(byId.values());
}

/**
 * Envoie le rappel à chacun. Renvoie le nombre d'envois tentés et réussis,
 * tous canaux confondus : l'appelant retente au prochain passage quand des
 * envois ont été tentés et qu'aucun n'a abouti (SMTP ou service push en panne).
 */
export async function sendReminder(recipients: Recipient[], reminder: Reminder) {
  let attempted = 0;
  let delivered = 0;

  for (const recipient of recipients) {
    if (recipient.notifyEmail && recipient.email) {
      attempted++;
      try {
        await sendNotificationEmail(recipient.email, reminder.email.subject, reminder.email.html);
        delivered++;
      } catch (error) {
        console.error(`[notify] Échec d'envoi à ${recipient.email}:`, error);
      }
    }

    const push = await sendPushToUser(recipient.id, reminder.push);
    attempted += push.attempted;
    delivered += push.delivered;
  }

  return { attempted, delivered };
}
