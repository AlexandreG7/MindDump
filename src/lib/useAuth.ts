"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

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
  const router = useRouter();

  const effectiveStatus = skipAuth ? "authenticated" : status;
  const effectiveSession = skipAuth ? DEV_SESSION : session;

  useEffect(() => {
    if (effectiveStatus === "unauthenticated") router.push("/login");
  }, [effectiveStatus, router]);

  return {
    session: effectiveSession,
    status: effectiveStatus,
    isReady: effectiveStatus === "authenticated",
  };
}
