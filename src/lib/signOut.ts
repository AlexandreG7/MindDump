import { signOut, type SignOutParams } from "next-auth/react";
import { clearOfflineCaches } from "./offlineCache";
import { clearPendingOps } from "./offlineLists";

/**
 * signOut de NextAuth, précédé de l'effacement des caches hors ligne et des
 * modifications de listes pas encore envoyées
 * (séparé de offlineCache.ts, importé par le service worker, qui ne doit pas
 * embarquer next-auth).
 */
export async function signOutAndClear(options?: SignOutParams<true>) {
  clearPendingOps();
  await clearOfflineCaches();
  return signOut(options);
}
