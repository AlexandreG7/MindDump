"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

/** Lance la connexion OAuth demandée par l'app, retour sur /api/mobile-auth/complete. */
export function MobileSignIn() {
  const params = useSearchParams();
  const provider = params.get("provider");
  // Liaison : le nonce relie ce retour OAuth à l'intention posée par /api/mobile-auth/start.
  const nonce = params.get("li");
  const started = useRef(false);

  useEffect(() => {
    if (!provider || started.current) return;
    started.current = true;
    signIn(provider, {
      callbackUrl: nonce && /^[a-f0-9]{32}$/.test(nonce)
        ? `/api/mobile-auth/complete?li=${nonce}`
        : "/api/mobile-auth/complete",
    });
  }, [provider, nonce]);

  return (
    <div className="flex flex-col items-center gap-3 pt-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Connexion en cours…</p>
    </div>
  );
}
