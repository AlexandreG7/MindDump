"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useGroupContext } from "@/components/GroupContext";

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true" && process.env.NODE_ENV !== "production";

const DEV_SESSION = {
  user: {
    id: "dev-user",
    name: "Dev User",
    email: "dev@minddump.local",
    image: null,
  },
};

export function useAuth() {
  const { data: session, status } = useSession();
  const { ready: groupReady } = useGroupContext();
  const router = useRouter();

  const effectiveStatus = skipAuth ? "authenticated" : status;
  const effectiveSession = skipAuth ? DEV_SESSION : session;

  useEffect(() => {
    if (effectiveStatus === "unauthenticated") router.push("/login");
  }, [effectiveStatus, router]);

  return {
    session: effectiveSession,
    status: effectiveStatus,
    // On attend aussi le groupe courant : les pages filtrent leurs données
    // dessus, sinon elles chargeraient tout deux fois (sans groupe, puis avec).
    isReady: effectiveStatus === "authenticated" && groupReady,
  };
}
