import { signOut, type SignOutParams } from "next-auth/react";
import { clearOfflineCaches } from "./offlineCache";
import { clearPendingOps } from "./offlineLists";
import { unsubscribeFromPush } from "./pushClient";

/**
 * signOut de NextAuth, précédé de ce qui ne doit pas survivre à la session sur
 * un appareil partagé : abonnement push, caches hors ligne, modifications de
 * listes pas encore envoyées. (Séparé de offlineCache.ts, importé par le
 * service worker, qui ne doit pas embarquer next-auth.)
 */
export async function signOutAndClear(options?: SignOutParams<true>) {
  // Tant que la session existe encore : le serveur doit oublier cet appareil.
  await unsubscribeFromPush();
  clearPendingOps();
  await clearOfflineCaches();
  return signOut(options);
}
