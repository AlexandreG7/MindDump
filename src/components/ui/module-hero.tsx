import * as React from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";
import { AnimatedNumber } from "./animated-number";

/**
 * Formes décoratives des en-têtes (aplats à l'encre, 9 à 14 % d'opacité) :
 * soleil pour les tâches, collines pour les courses, assiettes pour les repas,
 * carreaux pour l'agenda. Purement graphiques : `aria-hidden`.
 */
function Shapes({ tone }: { tone: Tone }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 220"
      preserveAspectRatio="xMaxYMax slice"
      className="hero-shape pointer-events-none absolute -bottom-px -right-px hidden h-full w-[min(100%,26rem)] text-on-tone md:block"
    >
      {tone === "todo" && (
        <g fill="currentColor">
          <circle cx="262" cy="64" r="74" opacity=".1" />
          <circle cx="262" cy="64" r="44" opacity=".12" />
          <path d="M0 220V168c52-26 104-8 160 8s112 6 160-30v74z" opacity=".1" />
        </g>
      )}
      {tone === "list" && (
        <g fill="currentColor">
          <path d="M0 220V150c60-48 118-30 170 6s96 18 150-28v92z" opacity=".1" />
          <path d="M60 220V178c52-30 112-16 170 10s64 8 90-8v40z" opacity=".13" />
          <circle cx="270" cy="52" r="26" opacity=".1" />
        </g>
      )}
      {tone === "meal" && (
        <g fill="none" stroke="currentColor" strokeWidth="14">
          <circle cx="250" cy="96" r="82" opacity=".09" />
          <circle cx="250" cy="96" r="52" opacity=".11" />
          <circle cx="250" cy="96" r="22" opacity=".14" />
        </g>
      )}
      {tone === "agenda" && (
        <g fill="currentColor">
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect key={`${r}${c}`} x={170 + c * 38} y={30 + r * 38} width="28" height="28" rx="9" opacity={(r + c) % 3 === 0 ? 0.16 : 0.07} />
            ))
          )}
        </g>
      )}
    </svg>
  );
}

/**
 * En-tête de page expressif : aplat de la teinte du module, titre en 800 serré,
 * gros compteur à rouleaux et pastilles de contexte. Remplace le titre de
 * page discret de la v1. Les actions (icônes de 48 px) se placent en haut à droite.
 */
export function ModuleHero({
  tone,
  title,
  count,
  countLabel,
  kicker,
  action,
  children,
  className,
}: {
  tone: Tone;
  title: string;
  /** Nombre mis en avant ; `null` tant que les données ne sont pas là. */
  count: number | null;
  /** Ce que compte le nombre : « à faire », « à prendre »… */
  countLabel: string;
  /** Petite ligne au-dessus du titre. */
  kicker?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <header className={cn("relative isolate overflow-hidden rounded-[1.75rem] px-5 pb-4 pt-3.5 md:rounded-[2rem] md:px-8 md:pb-5 md:pt-5", t.block, className)}>
      <Shapes tone={tone} />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {kicker && <p className="text-sm font-bold leading-tight opacity-80">{kicker}</p>}
          <h1 className="font-display text-[2.5rem] md:text-[3.5rem]">{title}</h1>
        </div>
        {action && <div className="relative flex shrink-0 items-center gap-1.5">{action}</div>}
      </div>
      <div className="relative mt-1 flex flex-wrap items-center gap-x-3 gap-y-2.5 md:mt-2">
        <div className="flex items-center gap-2">
          {count === null ? (
            <span className="font-display h-[3.25rem] w-14 rounded-2xl bg-on-tone/10 md:h-[4.5rem]" aria-hidden="true" />
          ) : (
            <AnimatedNumber value={count} className="font-display text-[3.25rem] leading-none md:text-[4.5rem]" />
          )}
          <p className="text-base font-bold leading-tight md:text-xl">{countLabel}</p>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2 md:ml-auto">{children}</div>}
      </div>
    </header>
  );
}

/** Pastille de contexte posée sur un aplat (encre sur voile clair). */
export function HeroChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full bg-on-tone/[0.12] px-3 text-sm font-bold tabular-nums", className)}>
      {children}
    </span>
  );
}

/** Bouton-icône rond posé sur un aplat (48 px, encre). */
export const HeroIconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full bg-on-tone/[0.12] text-on-tone transition-[transform,background-color] duration-150",
        "hover:bg-on-tone/20 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tone",
        className
      )}
      {...props}
    />
  )
);
HeroIconButton.displayName = "HeroIconButton";
