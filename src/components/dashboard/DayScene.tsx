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
      <div className="relative z-10 px-5 pb-32 pt-5 md:px-8 md:pb-40 md:pt-7">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-3 text-sm font-bold text-ink-foreground/75 first-letter:uppercase md:text-base">{dateLabel}</p>
          {action}
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="font-display min-w-0 text-[2.75rem] md:text-[5rem]">{greeting}</h1>
          <div className="shrink-0 text-right">
            {count === null ? (
              <span className="block h-[5.5rem] w-16 rounded-2xl bg-ink-foreground/10 md:h-[8rem]" aria-hidden="true" />
            ) : (
              <AnimatedNumber value={count} className="font-display text-[5.5rem] leading-none text-tone-todo md:text-[8rem]" />
            )}
            <p className="-mt-1 text-sm font-bold leading-tight text-ink-foreground/85 md:text-lg">{countLabel}</p>
          </div>
        </div>
        {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40 md:h-52">
        <span
          className={cn("sun absolute block h-20 w-20 rounded-full md:h-28 md:w-28", night ? "bg-ink-foreground/90" : "bg-tone-todo")}
          style={{ left: `${sunX}%`, bottom: `${18 + sunLift}px`, transition: "left 600ms var(--spring-soft), bottom 600ms var(--spring-soft)" }}
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
