"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { syncShareToken } from "@/lib/nativeDevice";
import { registerMatchDriveRelay } from "@/lib/matchDrive";

/**
 * Dans l'app connectée : fournit son jeton à l'extension de partage iOS et
 * relaie vers MindDump les appels de l'écran panier Match.
 */
export function NativeDeviceSync() {
  const { status } = useSession();
  useEffect(() => {
    if (status !== "authenticated") return;
    syncShareToken();
    registerMatchDriveRelay();
  }, [status]);
  return null;
}
