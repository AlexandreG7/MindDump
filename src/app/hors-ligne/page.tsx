import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { RetryButton } from "./RetryButton";

// Servie par le service worker (src/app/sw.ts) quand une page demandée hors
// ligne n'a jamais été vue sur cet appareil. Précachée au build : elle doit
// rester statique, sans donnée de compte.
export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <WifiOff className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Pas de connexion</h1>
          <p className="text-sm text-muted-foreground">
            Cette page n&apos;a pas encore été ouverte sur cet appareil. Les pages déjà
            consultées restent disponibles hors ligne.
          </p>
        </div>
        <RetryButton />
      </div>
    </div>
  );
}
