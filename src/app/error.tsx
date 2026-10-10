"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// Erreur dans une page : la navigation reste affichée, la page propose de se
// recharger au lieu de rester vide.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} onRetry={reset} />;
}
