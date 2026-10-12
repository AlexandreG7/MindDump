"use client";

import * as React from "react";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { springEase, prefersReducedMotion } from "@/lib/motionUi";
import { TONE_CLASSES, type Tone } from "./tone";

const TRIGGER = 76;
const MAX = 132;

/**
 * Ligne qu'on peut glisser au doigt : vers la droite pour cocher, vers la
 * gauche pour supprimer (l'annulation reste proposée par le parent). Ce n'est
 * qu'un raccourci : la case et la corbeille de la ligne gardent leur rôle et
 * leur `aria-label`, et rien n'est glissable à la souris ni au clavier.
 * Un glissement qui démarre à moins de 24 px du bord gauche est ignoré (geste
 * « retour » d'iOS).
 */
export function SwipeRow({
  children,
  tone = "todo",
  onSwipeRight,
  onSwipeLeft,
  className,
  frontClassName,
  onClick,
  ...rest
}: Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> & {
  tone?: Tone;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  frontClassName?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const front = React.useRef<HTMLDivElement>(null);
  const backRight = React.useRef<HTMLDivElement>(null);
  const backLeft = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ x: number; y: number; id: number; active: boolean; dx: number } | null>(null);
  const suppressClick = React.useRef(false);
  const enabled = !!(onSwipeRight || onSwipeLeft);

  const paint = (dx: number, animate: boolean) => {
    const el = front.current;
    if (!el) return;
    el.style.transition = animate ? `transform 420ms ${springEase()}` : "none";
    el.style.transform = dx ? `translateX(${dx}px)` : "";
    const p = Math.min(1, Math.abs(dx) / TRIGGER);
    if (backRight.current) backRight.current.style.opacity = dx > 0 ? String(0.35 + 0.65 * p) : "0";
    if (backLeft.current) backLeft.current.style.opacity = dx < 0 ? String(0.35 + 0.65 * p) : "0";
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType !== "touch" || e.clientX < 24) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false, dx: 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) {
        if (Math.abs(dy) > 12) drag.current = null;
        return;
      }
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const allowed = (dx > 0 && onSwipeRight) || (dx < 0 && onSwipeLeft) ? dx : dx / 6;
    // Résistance au-delà du seuil.
    const sign = Math.sign(allowed);
    const abs = Math.abs(allowed);
    d.dx = sign * (abs > TRIGGER ? TRIGGER + (abs - TRIGGER) * 0.35 : abs);
    paint(Math.max(-MAX, Math.min(MAX, d.dx)), false);
  };

  const end = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 80);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const fire = !cancelled && Math.abs(d.dx) >= TRIGGER * 0.98;
    paint(0, !prefersReducedMotion());
    if (fire && d.dx > 0) onSwipeRight?.();
    if (fire && d.dx < 0) onSwipeLeft?.();
  };

  const t = TONE_CLASSES[tone];
  return (
    <div className={cn("relative overflow-hidden rounded-[1.5rem]", className)} {...rest}>
      {enabled && (
        <>
          <div ref={backRight} aria-hidden className={cn("absolute inset-y-0 left-0 flex w-1/2 items-center pl-6 opacity-0", t.block)}>
            <Check className="h-6 w-6" strokeWidth={3} />
          </div>
          <div ref={backLeft} aria-hidden className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-end bg-destructive pr-6 text-destructive-foreground opacity-0">
            <Trash2 className="h-6 w-6" />
          </div>
        </>
      )}
      <div
        ref={front}
        className={cn("swipe-front relative", frontClassName)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onClick={onClick}
      >
        {children}
      </div>
    </div>
  );
}
