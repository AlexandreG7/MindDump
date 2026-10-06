import { isNativeApp } from "./native";

/**
 * Rappels locaux dans l'app (docs/app-mobile.md, étape 3.3, « Rappels
 * locaux »), avec `@capacitor/local-notifications` — sans APNs ni Firebase.
 *
 * Source de vérité : `GET /api/reminders/upcoming` (même règle que le cron,
 * voir `src/lib/reminders.ts`). On reprogramme à chaque ouverture / retour au
 * premier plan de l'app et après chaque mutation d'une tâche ou d'un
 * événement (`window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT))`).
 *
 * Les plugins Capacitor sont appelés par `window.Capacitor.Plugins` : le site
 * n'embarque pas `@capacitor/core` (voir `src/lib/native.ts`).
 */

export const REMINDERS_CHANGED_EVENT = "minddump:reminders-changed";

/** Signale qu'une tâche ou un événement a changé : reprogramme les rappels locaux. */
export function notifyRemindersChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT));
}

export type UpcomingReminder = {
  key: string;
  kind: "todo" | "event";
  itemId: string;
  title: string;
  body: string;
  fireAt: string;
  url: string;
};

type PermissionState = "granted" | "denied" | "prompt" | "prompt-with-rationale";
type PluginListenerHandle = { remove: () => Promise<void> };

type PendingNotification = {
  id: number;
  title?: string;
  body?: string;
  schedule?: { at?: string | Date };
  extra?: Record<string, unknown>;
};

type ActionPerformed = {
  notification: PendingNotification;
};

type LocalNotificationsPlugin = {
  schedule(options: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date };
      extra: { url: string; key: string };
      isExactNotification: boolean;
    }>;
  }): Promise<unknown>;
  cancel(options: { notifications: Array<{ id: number }> }): Promise<void>;
  getPending(): Promise<{ notifications: PendingNotification[] }>;
  checkPermissions(): Promise<{ display: PermissionState }>;
  requestPermissions(): Promise<{ display: PermissionState }>;
  addListener(
    event: "localNotificationActionPerformed",
    listener: (action: ActionPerformed) => void
  ): Promise<PluginListenerHandle> | PluginListenerHandle;
};

function plugin(): LocalNotificationsPlugin | undefined {
  if (typeof window === "undefined") return undefined;
  const plugins = (window as Window & { Capacitor?: { Plugins?: { LocalNotifications?: LocalNotificationsPlugin } } })
    .Capacitor?.Plugins;
  return plugins?.LocalNotifications;
}

/** Vrai dans une version de l'app qui embarque le plugin (toutes depuis cette étape). */
export function localRemindersAvailable(): boolean {
  return isNativeApp() && !!plugin();
}

/** Statut actuel de l'autorisation, ou `null` hors de l'app / plugin absent. */
export async function reminderPermissionStatus(): Promise<PermissionState | null> {
  const p = plugin();
  if (!p) return null;
  try {
    return (await p.checkPermissions()).display;
  } catch {
    return null;
  }
}

/**
 * Demande explicite (depuis les réglages de notifications) : à utiliser quand
 * l'utilisateur active l'interrupteur. Sans effet si déjà accordée ou si
 * l'OS a déjà refusé définitivement (il ne réaffiche alors pas de dialogue).
 */
export async function requestReminderPermission(): Promise<PermissionState | null> {
  const p = plugin();
  if (!p) return null;
  try {
    return (await p.requestPermissions()).display;
  } catch {
    return null;
  }
}

/**
 * Dérive un id de notification locale (entier 32 bits positif) d'une clé
 * stable (`todo-<id>`, `event-<id>-<timestamp>`) : hash FNV-1a, stable d'un
 * appel à l'autre, pour pouvoir annuler/remplacer sans tout reprogrammer.
 */
export function reminderNotificationId(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 : entier non signé 32 bits ; %0x7fffffff (modulo le max int32 signé,
  // jamais 0 lui-même) pour rester dans l'intervalle attendu par le plugin.
  const unsigned = hash >>> 0;
  return (unsigned % 0x7fffffff) + 1;
}

async function fetchUpcomingReminders(): Promise<UpcomingReminder[] | null> {
  try {
    const res = await fetch("/api/reminders/upcoming");
    if (!res.ok) return null;
    const data = (await res.json()) as { reminders: UpcomingReminder[] };
    return data.reminders;
  } catch {
    return null;
  }
}

// Verrou commun : synchronisation et annulation totale ne se chevauchent
// jamais (sinon une synchro déjà en cours pourrait reprogrammer des rappels
// juste après qu'on les a annulés, par exemple en désactivant l'interrupteur).
let lock: Promise<unknown> = Promise.resolve();
let syncQueued = false;

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}

/**
 * Reprogramme les rappels locaux pour refléter `/api/reminders/upcoming` :
 * annule ce qui n'y figure plus, programme ce qui manque ou a changé. Ne
 * programme jamais une `fireAt` déjà passée. Vide la liste (donc annule tout)
 * si l'utilisateur a désactivé les rappels (`notifyReminders`) : l'API renvoie
 * alors `reminders: []`.
 *
 * Sérialisé : un appel pendant qu'un autre tourne attend la fin, et les appels
 * en attente se regroupent en une seule exécution.
 */
export function syncLocalReminders(): Promise<void> {
  if (!localRemindersAvailable()) return Promise.resolve();
  if (syncQueued) return lock as Promise<void>;
  syncQueued = true;
  return withLock(async () => {
    syncQueued = false;
    await doSync();
  });
}

async function doSync(): Promise<void> {
  const p = plugin();
  if (!p) return;
  const reminders = await fetchUpcomingReminders();
  if (reminders === null) return; // pas de session, ou réseau indisponible : on ne touche à rien.

  const now = Date.now();
  const desired = reminders
    .map((r) => ({ reminder: r, id: reminderNotificationId(r.key), at: new Date(r.fireAt).getTime() }))
    .filter((d) => d.at > now);

  const pending = (await p.getPending().catch(() => ({ notifications: [] as PendingNotification[] })))
    .notifications;
  const pendingById = new Map(pending.map((n) => [n.id, n]));

  const toCancel = pending
    .filter((n) => !desired.some((d) => d.id === n.id))
    .map((n) => ({ id: n.id }));

  const toSchedule = desired
    .filter((d) => {
      const existing = pendingById.get(d.id);
      if (!existing) return true;
      const sameTime = new Date(existing.schedule?.at ?? 0).getTime() === d.at;
      const sameContent = existing.title === d.reminder.title && existing.body === d.reminder.body;
      return !(sameTime && sameContent);
    })
    .map((d) => ({
      id: d.id,
      title: d.reminder.title,
      body: d.reminder.body,
      schedule: { at: new Date(d.at) },
      extra: { url: d.reminder.url, key: d.reminder.key },
      // Android : une alarme inexacte suffit pour un rappel (voir
      // docs/app-mobile-build.md) ; sans ça, le plugin ouvrirait les
      // réglages système « Alarmes et rappels » au premier rappel programmé.
      isExactNotification: false,
    }));

  if (toCancel.length) await p.cancel({ notifications: toCancel }).catch(() => {});
  // schedule() (re)programme par id. Il demande lui-même l'autorisation
  // système quand elle est encore « indéterminée » : l'invite peut donc
  // apparaître à la première synchronisation après connexion, s'il existe des
  // rappels à programmer. Jamais en boucle si elle a été refusée.
  if (toSchedule.length) await p.schedule({ notifications: toSchedule }).catch(() => {});
}

/**
 * Annule tout : désactivation de l'interrupteur, déconnexion, changement de
 * compte. Passe par le même verrou que `syncLocalReminders`.
 */
export function cancelAllLocalReminders(): Promise<void> {
  return withLock(async () => {
    const p = plugin();
    if (!p) return;
    const pending = await p.getPending().catch(() => ({ notifications: [] as PendingNotification[] }));
    if (pending.notifications.length) {
      await p.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) }).catch(() => {});
    }
  });
}

/**
 * Appui sur une notification : navigue vers son `extra.url`. À monter une
 * fois (voir `NativeDeviceSync`) ; couvre aussi le démarrage à froid (le
 * plugin met en attente l'action jusqu'à ce qu'un écouteur soit posé).
 */
export function onReminderNotificationTapped(callback: (url: string) => void): () => void {
  const p = plugin();
  if (!p) return () => {};
  let removed = false;
  let handle: PluginListenerHandle | undefined;
  Promise.resolve(
    p.addListener("localNotificationActionPerformed", (action) => {
      const url = action.notification?.extra?.url;
      if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) callback(url);
    })
  )
    .then((h) => {
      handle = h;
      if (removed) h.remove().catch(() => {});
    })
    .catch(() => {});
  return () => {
    removed = true;
    handle?.remove().catch(() => {});
  };
}
