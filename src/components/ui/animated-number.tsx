"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion, useIsoLayoutEffect } from "@/lib/motionUi";

/**
 * Compteur à rouleaux : chaque chiffre est une colonne 0-9 qui glisse avec un
 * ressort (transform seulement). Adapté de React Bits « Counter » (qui dépend
 * de `motion`) en CSS pur. Le HTML serveur contient la valeur finale ; au
 * montage, les rouleaux partent de zéro. Le texte lu par les lecteurs d'écran
 * est la valeur réelle.
 */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const digits = String(Math.max(0, Math.round(value))).split("");
  // "final" : valeur directe (rendu serveur, mouvement réduit). "zero" : rouleaux
  // remis à zéro avant la première peinture, puis "final" une image plus tard.
  const [phase, setPhase] = useState<"final" | "zero">("final");

  useIsoLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    setPhase("zero");
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("final")));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <span className={cn("inline-flex", className)}>
      <span className="sr-only">{value}</span>
      <span className="odo" aria-hidden="true">
        {digits.map((d, i) => (
          <span key={digits.length - i} className="odo-col" style={{ ["--d" as string]: phase === "zero" ? 0 : Number(d) }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
