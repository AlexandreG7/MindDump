import webpush from "web-push";
import { prisma } from "./prisma";

/**
 * Notifications Web Push (docs/app-mobile.md, étape 1.4).
 *
 * Clés VAPID dans l'environnement ; générer une paire avec
 * `npx web-push generate-vapid-keys`. Sans elles, le push est simplement
 * désactivé (les rappels partent par e-mail seulement).
 */
const publicKey = process.env.VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";
const subject = process.env.VAPID_SUBJECT || "";

export const pushEnabled = !!(publicKey && privateKey && subject);

if (pushEnabled) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function pushPublicKey(): string | null {
  return pushEnabled ? publicKey : null;
}

export type PushMessage = {
  title: string;
  body: string;
  /** Page ouverte au clic sur la notification (chemin relatif). */
  url: string;
  /** Une notification avec le même tag remplace la précédente sur l'appareil. */
  tag?: string;
};

// Un rappel sans intérêt passé ce délai (le service push le jette sinon).
const TTL_SECONDS = 12 * 3600;

/**
 * Envoie un message à tous les appareils d'un utilisateur. Un abonnement que
 * le service push déclare expiré (404, 410) est supprimé.
 * Renvoie { attempted, delivered } en nombre d'appareils.
 */
export async function sendPushToUser(userId: string, message: PushMessage) {
  if (!pushEnabled) return { attempted: 0, delivered: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify(message);
  let delivered = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: TTL_SECONDS }
      );
      delivered++;
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error(`[push] Échec d'envoi (${status ?? "réseau"})`, error);
      }
    }
  }

  return { attempted: subscriptions.length, delivered };
}
