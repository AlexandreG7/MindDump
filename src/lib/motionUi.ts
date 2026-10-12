"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Petits outils de mouvement de l'app (aucune dépendance, WAAPI + CSS).
 * Tout est neutralisé quand l'utilisateur demande moins de mouvement.
 */

export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Ressort amorti échantillonné (raideur 300, amortissement 24 : dépassement de 5 %).
const SPRING_SOFT =
  "linear(0, 0.074, 0.239, 0.434, 0.618, 0.771, 0.887, 0.967, 1.015, 1.04, 1.049, 1.047, 1.039, 1.03, 1.021, 1.013, 1.007, 1.002, 1, 0.998, 0.998, 0.998, 1)";
const SPRING_FALLBACK = "cubic-bezier(0.22, 1.25, 0.4, 1)";

export function springEase(): string {
  const ok = typeof CSS !== "undefined" && CSS.supports?.("animation-timing-function", "linear(0, 1)");
  return ok ? SPRING_SOFT : SPRING_FALLBACK;
}

/**
 * Gerbe d'étincelles à l'endroit d'un élément (adapté de React Bits « ClickSpark » :
 * mêmes traits qui s'éloignent en rétrécissant, mais en WAAPI sur des éléments
 * jetables plutôt qu'avec un canvas et une boucle d'animation permanente).
 */
export function burst(origin: Element | null, opts: { count?: number; radius?: number; colors?: string[]; size?: number } = {}) {
  if (!origin || prefersReducedMotion() || typeof document === "undefined") return;
  const { count = 9, radius = 30, colors = ["currentColor"], size = 9 } = opts;
  const r = origin.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:0;height:0;pointer-events:none;z-index:70`;
  document.body.appendChild(layer);
  let pending = count;
  for (let i = 0; i < count; i++) {
    const a = (360 / count) * i + (i % 2 ? 8 : -8);
    const spark = document.createElement("i");
    spark.style.cssText = `position:absolute;left:-${size / 2}px;top:-1.5px;width:${size}px;height:3px;border-radius:3px;background:${colors[i % colors.length]}`;
    layer.appendChild(spark);
    const far = radius * (i % 3 === 0 ? 1.25 : 1);
    const anim = spark.animate(
      [
        { transform: `rotate(${a}deg) translateX(${radius * 0.35}px) scaleX(1)`, opacity: 1 },
        { transform: `rotate(${a}deg) translateX(${far}px) scaleX(0.25)`, opacity: 0 },
      ],
      { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
    );
    anim.onfinish = () => {
      if (--pending === 0) layer.remove();
    };
  }
  window.setTimeout(() => layer.remove(), 900);
}

/**
 * Transition de liste « FLIP » avec ressort : les lignes qui changent de place
 * glissent vers leur nouvelle position, les nouvelles lignes se posent
 * (fondu, léger agrandissement). Les enfants directs du conteneur portent
 * `data-flip="<clé stable>"`. `signature` change quand l'ordre ou le contenu
 * change. Le conteneur doit être `position: relative`.
 */
export function useFlip(ref: RefObject<HTMLElement>, signature: string) {
  const prev = useRef<Map<string, number> | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(":scope > [data-flip]"));
    const next = new Map<string, number>();
    nodes.forEach((n) => next.set(n.dataset.flip!, n.offsetTop));
    const before = prev.current;
    prev.current = next;
    if (prefersReducedMotion() || nodes.length === 0 || typeof el.animate !== "function") return;

    const easing = springEase();
    if (!before || before.size === 0) {
      // Premier affichage des lignes : elles arrivent l'une après l'autre.
      nodes.slice(0, 8).forEach((n, i) => {
        n.animate(
          [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
          { duration: 520, delay: i * 40, easing, fill: "backwards" }
        );
      });
      return;
    }
    nodes.forEach((n) => {
      const key = n.dataset.flip!;
      const old = before.get(key);
      if (old === undefined) {
        n.animate(
          [{ opacity: 0, transform: "translateY(-12px) scale(0.94)" }, { opacity: 1, transform: "none" }],
          { duration: 540, easing, fill: "backwards" }
        );
      } else {
        const dy = old - next.get(key)!;
        if (Math.abs(dy) > 1) {
          n.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 540, easing });
        }
      }
    });
  }, [ref, signature]);
}

/** Vrai quand un compteur passe de « il en restait » à zéro (félicitations). */
export function useJustReachedZero(count: number | null): boolean {
  const last = useRef<number | null>(null);
  const hit = last.current !== null && last.current > 0 && count === 0;
  useEffect(() => {
    last.current = count;
  }, [count]);
  return hit;
}
