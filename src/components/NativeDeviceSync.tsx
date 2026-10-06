"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { syncShareToken } from "@/lib/nativeDevice";
import { registerMatchDriveRelay } from "@/lib/matchDrive";
import {
  REMINDERS_CHANGED_EVENT,
  localRemindersAvailable,
  cancelAllLocalReminders,
  onReminderNotificationTapped,
  syncLocalReminders,
} from "@/lib/localReminders";

type AppPlugin = {
  addListener(
    event: "resume",
    listener: () => void
  ): Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
};

function nativeAppPlugin(): AppPlugin | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: { Plugins?: { App?: AppPlugin } } }).Capacitor?.Plugins?.App;
}

/**
 * Dans l'app connectée : fournit son jeton à l'extension de partage iOS,
 * relaie vers MindDump les appels de l'écran panier Match, et programme les
 * rappels locaux (docs/app-mobile.md, étape 3.3) — à l'ouverture, à chaque
 * retour au premier plan et après toute modification d'une tâche ou d'un
 * événement (`notifyRemindersChanged`).
 */
export function NativeDeviceSync() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      // Session expirée ou changement de compte : les rappels de l'ancien
      // compte ne doivent pas survivre sur ce téléphone.
      if (localRemindersAvailable()) cancelAllLocalReminders();
      return;
    }
    if (status !== "authenticated") return;
    syncShareToken();
    registerMatchDriveRelay();
    if (!localRemindersAvailable()) return;

    syncLocalReminders();

    const onForeground = () => syncLocalReminders();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onForeground();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(REMINDERS_CHANGED_EVENT, onForeground);

    let appListener: { remove: () => Promise<void> } | undefined;
    let cleanedUp = false;
    Promise.resolve(nativeAppPlugin()?.addListener("resume", onForeground))
      .then((handle) => {
        if (!handle) return;
        appListener = handle;
        if (cleanedUp) handle.remove().catch(() => {});
      })
      .catch(() => {});

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(REMINDERS_CHANGED_EVENT, onForeground);
      cleanedUp = true;
      appListener?.remove().catch(() => {});
    };
  }, [status]);

  // Appui sur un rappel local : navigue vers la tâche ou l'événement
  // (démarrage à froid inclus, le plugin met l'action en attente jusqu'ici).
  useEffect(() => {
    if (status !== "authenticated") return;
    return onReminderNotificationTapped((url) => router.push(url));
  }, [router, status]);

  return null;
}
