"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { isChunkLoadError, reloadOnce } from "@/lib/reloadGuard";

/**
 * Écran affiché quand l'arbre React casse, à la place d'une page vide. Un
 * morceau de JS introuvable (déploiement entre-temps) se règle par un
 * rechargement : on le fait seul, une fois.
 * Styles en ligne : utilisé aussi par global-error, qui remplace le layout et
 * donc les feuilles de style.
 */
export function ErrorScreen({ error, onRetry }: { error: Error & { digest?: string }; onRetry?: () => void }) {
  useEffect(() => {
    console.error(error);
    if (isChunkLoadError(error)) reloadOnce();
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        minHeight: "60dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 320 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Un problème est survenu</h1>
        <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 20px" }}>
          La page n&apos;a pas pu s&apos;afficher. Recharge-la pour reprendre.
        </p>
        <button
          type="button"
          onClick={() => (onRetry && !isChunkLoadError(error) ? onRetry() : window.location.reload())}
          style={{
            minHeight: 44,
            padding: "0 20px",
            borderRadius: 8,
            border: "none",
            background: "#e68037",
            color: "#1c2333",
            fontSize: 15,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <RotateCw size={16} aria-hidden />
          Recharger
        </button>
      </div>
    </div>
  );
}
