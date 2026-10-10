"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// Erreur dans le layout lui-même : remplace toute la page, d'où <html> ici.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <ErrorScreen error={error} />
      </body>
    </html>
  );
}
