"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";

/** Délai d'inactivité avant de masquer le curseur souris en plein écran. */
const CURSOR_IDLE_MS = 3000;

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

type Mode = "pending" | "hidden" | "api" | "ios-help";

const fsDoc = () => document as FsDocument;
const isFullscreen = () => !!(fsDoc().fullscreenElement ?? fsDoc().webkitFullscreenElement);

/** PWA installée ou navigateur déjà en plein écran : l'interface du navigateur est absente. */
function isStandalone(): boolean {
  const mq = (q: string) => window.matchMedia?.(q).matches ?? false;
  return mq("(display-mode: standalone)") || mq("(display-mode: fullscreen)") || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  // iPadOS 13+ se présente comme un Mac : on le reconnaît à l'écran tactile.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function detectMode(): Mode {
  if (isStandalone()) return "hidden";
  const el = document.documentElement as FsElement;
  const d = fsDoc();
  const supported = (d.fullscreenEnabled || d.webkitFullscreenEnabled) && (!!el.requestFullscreen || !!el.webkitRequestFullscreen);
  if (supported) return "api";
  // Sans API (iPhone, certains Safari) : seule l'installation sur l'écran d'accueil donne un vrai plein écran.
  return isIOS() ? "ios-help" : "hidden";
}

/**
 * Bouton discret « Plein écran » de l'écran mural. Caché quand le plein écran est
 * déjà acquis (PWA installée) ou impossible ; sur iOS sans API, il ouvre une aide courte.
 */
export function FullscreenToggle() {
  const [mode, setMode] = useState<Mode>("pending");
  const [active, setActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setMode(detectMode());
    setActive(isFullscreen());
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const recheck = () => setMode(detectMode());
    mq?.addEventListener?.("change", recheck);
    return () => mq?.removeEventListener?.("change", recheck);
  }, []);

  // Icône à jour même quand on quitte avec Échap ou un geste système.
  useEffect(() => {
    const sync = () => setActive(isFullscreen());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  // Curseur masqué après quelques secondes sans mouvement, en plein écran sur ordinateur.
  useEffect(() => {
    if (!active || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      root.removeAttribute("data-cursor-idle");
      clearTimeout(timer);
      timer = setTimeout(() => root.setAttribute("data-cursor-idle", ""), CURSOR_IDLE_MS);
    };
    arm();
    window.addEventListener("mousemove", arm);
    window.addEventListener("mousedown", arm);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", arm);
      window.removeEventListener("mousedown", arm);
      root.removeAttribute("data-cursor-idle");
    };
  }, [active]);

  const toggle = useCallback(async () => {
    if (mode === "ios-help") {
      setHelpOpen((v) => !v);
      return;
    }
    try {
      const el = document.documentElement as FsElement;
      if (isFullscreen()) {
        await (fsDoc().exitFullscreen?.() ?? fsDoc().webkitExitFullscreen?.());
      } else {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      // Refusé par le navigateur : l'écran reste tel quel, rien à signaler.
    }
  }, [mode]);

  if (mode === "pending" || mode === "hidden") return null;

  const Icon = active ? Minimize : Maximize;
  const label = mode === "ios-help" ? "Aide : plein écran" : active ? "Quitter le plein écran" : "Plein écran";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        aria-pressed={mode === "api" ? active : undefined}
        aria-expanded={mode === "ios-help" ? helpOpen : undefined}
        className={cn(
          "h-11 w-11 -m-1 flex items-center justify-center rounded-full text-muted-foreground",
          "opacity-60 hover:opacity-100 hover:bg-secondary focus-visible:opacity-100 touch:opacity-70",
          "transition-[opacity,background-color,transform] duration-150 active:scale-95 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </button>
      {helpOpen && (
        <p
          role="status"
          className="absolute right-0 top-12 z-10 w-64 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground shadow-md"
        >
          Pour un vrai plein écran, ajoute la page à l&apos;écran d&apos;accueil (Partager, puis « Sur l&apos;écran d&apos;accueil »).
        </p>
      )}
    </div>
  );
}
