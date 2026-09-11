"use client";

import { useSession } from "next-auth/react";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/landing/Landing";

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true" && process.env.NODE_ENV !== "production";

export default function Home() {
  const { status } = useSession();

  if (skipAuth || status === "authenticated") return <Dashboard />;

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return <Landing />;
}
