"use client";

import { useEffect, useState } from "react";
import {
  APP_INTRO_ATTRIBUTE,
  APP_INTRO_LOGO_SIZE,
  APP_INTRO_MAX_MS,
  APP_INTRO_MESSAGE,
} from "@/lib/appIntro";

/**
 * Animation d'ouverture de l'app (src/lib/appIntro.ts). Invisible par défaut :
 * seul le script du <head> l'active, dans l'app et au démarrage à froid. Le
 * mouvement est en CSS ; ce composant ne fait que retirer l'overlay du DOM à
 * la fin (ou après le filet de sécurité).
 */
export function AppIntro() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (!html.hasAttribute(APP_INTRO_ATTRIBUTE)) {
      setDone(true);
      return;
    }
    const finish = () => {
      html.removeAttribute(APP_INTRO_ATTRIBUTE);
      setDone(true);
    };
    const timer = window.setTimeout(finish, APP_INTRO_MAX_MS);
    const root = document.getElementById("app-intro");
    const onEnd = (e: AnimationEvent) => {
      if (e.target === root && e.animationName === "app-intro-out") finish();
    };
    root?.addEventListener("animationend", onEnd);
    return () => {
      window.clearTimeout(timer);
      root?.removeEventListener("animationend", onEnd);
    };
  }, []);

  if (done) return null;

  return (
    <div id="app-intro" className="app-intro" aria-hidden="true">
      <div className="app-intro-hop">
        <div className="app-intro-flip">
          <svg
            width={APP_INTRO_LOGO_SIZE}
            height={APP_INTRO_LOGO_SIZE}
            viewBox="0 0 32 32"
            focusable="false"
          >
            <rect width="32" height="32" rx="8" fill="#F97316" />
            <path
              d="M9 23V10l7 8 7-8v13"
              fill="none"
              stroke="#fff"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <p className="app-intro-msg">{APP_INTRO_MESSAGE}</p>
    </div>
  );
}
