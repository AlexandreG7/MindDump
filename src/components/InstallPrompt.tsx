"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { isNativeApp } from "@/lib/native";

/**
 * Invitation discrète à installer MindDump (docs/app-mobile.md, étape 1.5) :
 * bouton d'installation sur Android / Chrome, rappel du geste sur iPhone.
 * Jamais affichée une fois l'app installée (PWA ou app native), ni après
 * avoir été fermée.
 */

type InstallEvent = Event & { prompt: () => Promise<void> };

const DISMISSED_KEY = "installPromptDismissed";

// Chrome peut émettre l'événement avant le montage du composant : on le garde.
let deferredPrompt: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallEvent;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((listener) => listener());
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Seul Safari propose « Sur l'écran d'accueil » de façon fiable.
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {}
    if (dismissed || isStandalone() || isNativeApp()) return;

    const update = () => setMode(deferredPrompt ? "android" : isIosSafari() ? "ios" : null);
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const dismiss = () => {
    setMode(null);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {}
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    deferredPrompt = null;
    setMode(null);
  };

  if (!mode) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
      {mode === "android" ? (
        <>
          <Download className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 min-w-0 text-muted-foreground">
            Installe MindDump pour l&apos;ouvrir comme une app, même hors ligne.
          </span>
          <button onClick={install} className="font-medium text-primary hover:underline shrink-0">
            Installer
          </button>
        </>
      ) : (
        <>
          <Share className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 min-w-0 text-muted-foreground">
            Pour l&apos;installer : Partager, puis « Sur l&apos;écran d&apos;accueil ».
          </span>
        </>
      )}
      <button
        onClick={dismiss}
        aria-label="Ne plus afficher"
        title="Ne plus afficher"
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
