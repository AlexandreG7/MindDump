"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  // Le réseau revient : on quitte cette page sans attendre un appui, sinon
  // l'app reste bloquée sur « Pas de connexion » alors qu'elle est en ligne.
  useEffect(() => {
    const onOnline = () => window.location.reload();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <Button variant="outline" className="gap-2" onClick={() => window.location.reload()}>
      <RotateCw className="h-4 w-4" />
      Réessayer
    </Button>
  );
}
