import { signOut, type SignOutParams } from "next-auth/react";
import { clearOfflineCaches } from "./offlineCache";

/**
 * signOut de NextAuth, précédé de l'effacement des caches hors ligne
 * (séparé de offlineCache.ts, importé par le service worker, qui ne doit pas
 * embarquer next-auth).
 */
export async function signOutAndClear(options?: SignOutParams<true>) {
  await clearOfflineCaches();
  return signOut(options);
}
