import { signOut, type SignOutParams } from "next-auth/react";
import { clearOfflineCaches } from "./offlineCache";
import { clearPendingOps } from "./offlineLists";
import { unsubscribeFromPush } from "./pushClient";
import { cancelAllLocalReminders } from "./localReminders";
import { clearShareToken } from "./nativeDevice";

/**
 * signOut de NextAuth, précédé de ce qui ne doit pas survivre à la session sur
 * un appareil partagé : abonnement push, rappels locaux programmés (leurs titres), caches hors ligne, modifications de
 * listes pas encore envoyées. (Séparé de offlineCache.ts, importé par le
 * service worker, qui ne doit pas embarquer next-auth.)
 */
export async function signOutAndClear(options?: SignOutParams<true>) {
  // Tant que la session existe encore : le serveur doit oublier cet appareil
  // (abonnement push, et appareil de l'app mobile le cas échéant).
  await unsubscribeFromPush();
  await fetch("/api/users/me/devices/current", { method: "DELETE" }).catch(() => {});
  await clearShareToken();
  await cancelAllLocalReminders();
  clearPendingOps();
  await clearOfflineCaches();
  return signOut(options);
}
