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
    <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      {mode === "android" ? (
        <>
          <Download className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>MindDump s&apos;installe comme une app, même hors ligne.</span>
          <button onClick={install} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">
            Installer
          </button>
        </>
      ) : (
        <>
          <Share className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Pour l&apos;installer : Partager, puis « Sur l&apos;écran d&apos;accueil ».</span>
        </>
      )}
      <button
        onClick={dismiss}
        aria-label="Ne plus afficher"
        title="Ne plus afficher"
        className="p-1 -m-0.5 rounded-md hover:text-foreground hover:bg-secondary shrink-0"
      >
        <X className="h-3 w-3" />
      </button>
    </p>
  );
}
