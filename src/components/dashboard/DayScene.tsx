"use client";

import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

/**
 * Scène de l'accueil : le ciel d'encre, un soleil qui suit l'heure de la
 * journée (lune la nuit) et quatre collines, une par module (agenda, repas,
 * courses, tâches). Les collines se lèvent à l'ouverture. Décor purement
 * graphique (`aria-hidden`) ; le texte et les chiffres sont du vrai HTML.
 */
export function DayScene({
  dateLabel,
  greeting,
  count,
  countLabel,
  action,
  children,
}: {
  dateLabel: string;
  greeting: React.ReactNode;
  /** Nombre de choses prévues aujourd'hui ; `null` pendant le chargement. */
  count: number | null;
  countLabel: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  // Heure locale lue après le montage (le rendu serveur n'a pas de fuseau).
  const [hour, setHour] = useState(12);
  useEffect(() => setHour(new Date().getHours() + new Date().getMinutes() / 60), []);

  const night = hour < 6 || hour >= 21;
  const t = Math.min(1, Math.max(0, (hour - 6) / 15)); // 0 au lever, 1 au coucher
  const sunX = night ? 74 : 10 + t * 62;
  // La nuit, la lune se tient au-dessus des collines.
  const sunLift = night ? 96 : Math.sin(t * Math.PI) * 78;

  return (
    <section aria-label="Aperçu de la journée" className="relative isolate overflow-hidden rounded-[2rem] bg-ink text-ink-foreground">
      <div className="relative z-10 px-5 pb-16 pt-4 md:px-8 md:pb-32 md:pt-6">
        <p className="text-sm font-bold text-ink-foreground/75 first-letter:uppercase md:text-base">{dateLabel}</p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <h1 className="font-display min-w-0 text-[2.25rem] md:text-[3.5rem]">{greeting}</h1>
          <div className="shrink-0 text-right">
            {count === null ? (
              <span className="block h-[3.5rem] w-12 rounded-2xl bg-ink-foreground/10 md:h-[5rem]" aria-hidden="true" />
            ) : (
              <AnimatedNumber value={count} className="font-display text-[3.5rem] leading-none text-tone-todo md:text-[5rem]" />
            )}
            <p className="mt-0.5 text-sm font-bold leading-tight text-ink-foreground/85 md:text-base">{countLabel}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {children}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-14 md:h-40">
        <span
          className={cn("sun absolute block h-11 w-11 rounded-full [--k:0.16] md:h-20 md:w-20 md:[--k:0.5]", night ? "bg-ink-foreground/90" : "bg-tone-todo")}
          style={{ left: `${sunX}%`, "--lift": sunLift, bottom: "calc(6px + var(--lift) * var(--k) * 1px)", transition: "left 600ms var(--spring-soft), bottom 600ms var(--spring-soft)" } as React.CSSProperties}
        />
        <svg className="hill absolute inset-x-0 bottom-0 h-full w-full" viewBox="0 0 400 160" preserveAspectRatio="none">
          <path d="M0 160V70C60 30 120 36 190 62S330 84 400 40V160Z" className="fill-tone-agenda" />
        </svg>
        <svg className="hill absolute inset-x-0 bottom-0 h-[78%] w-full" viewBox="0 0 400 130" preserveAspectRatio="none">
          <path d="M0 130V60C70 96 130 90 200 52S330 30 400 70V130Z" className="fill-tone-meal" />
        </svg>
        <svg className="hill absolute inset-x-0 bottom-0 h-[56%] w-full" viewBox="0 0 400 100" preserveAspectRatio="none">
          <path d="M0 100V44C60 14 140 20 210 48S340 70 400 36V100Z" className="fill-tone-list" />
        </svg>
        <svg className="hill absolute inset-x-0 bottom-0 h-[32%] w-full" viewBox="0 0 400 60" preserveAspectRatio="none">
          <path d="M0 60V30C80 6 150 12 230 30S340 40 400 14V60Z" className="fill-tone-todo" />
        </svg>
      </div>
    </section>
  );
}
