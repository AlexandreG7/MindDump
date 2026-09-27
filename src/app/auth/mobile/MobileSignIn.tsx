"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

/** Lance la connexion OAuth demandée par l'app, retour sur /api/mobile-auth/complete. */
export function MobileSignIn() {
  const provider = useSearchParams().get("provider");
  const started = useRef(false);

  useEffect(() => {
    if (!provider || started.current) return;
    started.current = true;
    signIn(provider, { callbackUrl: "/api/mobile-auth/complete" });
  }, [provider]);

  return (
    <div className="flex flex-col items-center gap-3 pt-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Connexion en cours…</p>
    </div>
  );
}
