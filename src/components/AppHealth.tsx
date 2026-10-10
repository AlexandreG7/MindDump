"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RotateCw } from "lucide-react";
import { BUILD_ID } from "@/lib/buildId";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { isChunkLoadError, reloadOnce } from "@/lib/reloadGuard";

/** Après ce temps passé en arrière-plan, on vérifie que la version est la bonne. */
const CHECK_AFTER_HIDDEN_MS = 20_000;
/** Session toujours en cours de lecture : on propose de recharger, puis on le fait. */
const SLOW_BANNER_MS = 10_000;
const SLOW_RELOAD_MS = 25_000;

/** Une fiche ou un formulaire est en cours d'usage : un rechargement ferait perdre la saisie. */
function userIsBusy(): boolean {
  if (document.querySelector('[role="dialog"], dialog[open]')) return true;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return (
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
    el.isContentEditable ||
    el.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

/**
 * Filets de sécurité contre l'écran vide dans l'app (et la PWA) :
 * - un morceau de JS introuvable (déploiement entre deux ouvertures) recharge la page ;
 * - au retour au premier plan, si le serveur a une autre version, la page se recharge
 *   (différé tant qu'une fiche ou un champ est en cours d'édition) ;
 * - si la session n'arrive pas (connexion morte au retour d'arrière-plan), un
 *   bandeau « Recharger » apparaît, puis la page se recharge d'elle-même.
 */
export function AppHealth() {
  const { status } = useSession();
  const [slow, setSlow] = useState(false);

  // Chunks périmés.
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) reloadOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // Retour au premier plan : nouvelle version déployée ?
  useEffect(() => {
    if (BUILD_ID === "dev") return;
    let hiddenAt = 0;
    let pending = false;
    const onVisibility = async () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const longEnough = hiddenAt > 0 && Date.now() - hiddenAt >= CHECK_AFTER_HIDDEN_MS;
      if (!longEnough && !pending) return;
      hiddenAt = 0;
      pending = false;
      try {
        const res = await fetchWithTimeout("/api/version", { cache: "no-store" }, 5000);
        const data = (await res.json()) as { build?: string };
        if (data.build && data.build !== BUILD_ID) {
          if (userIsBusy()) {
            // Saisie en cours : on refera le contrôle au prochain passage au
            // premier plan.
            pending = true;
            return;
          }
          reloadOnce();
        }
      } catch {
        // Hors ligne ou serveur injoignable : on garde la page affichée.
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Session qui n'arrive jamais.
  useEffect(() => {
    if (status !== "loading") {
      setSlow(false);
      return;
    }
    const banner = setTimeout(() => setSlow(true), SLOW_BANNER_MS);
    const reload = setTimeout(() => reloadOnce(), SLOW_RELOAD_MS);
    return () => {
      clearTimeout(banner);
      clearTimeout(reload);
    };
  }, [status]);

  if (!slow) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium text-foreground shadow-lg"
      >
        <RotateCw className="h-4 w-4" aria-hidden />
        Le chargement est long. Recharger
      </button>
    </div>
  );
}
