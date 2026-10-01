"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { syncShareToken } from "@/lib/nativeDevice";

/** Dans l'app iOS connectée, fournit son jeton à l'extension de partage. */
export function NativeDeviceSync() {
  const { status } = useSession();
  useEffect(() => {
    if (status === "authenticated") syncShareToken();
  }, [status]);
  return null;
}
