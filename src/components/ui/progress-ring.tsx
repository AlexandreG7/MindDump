import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";

/**
 * Anneau de progression (SVG, une seule propriété animée : stroke-dashoffset).
 * Décoratif : le parent expose le texte (« 3 sur 10 »).
 */
export function ProgressRing({
  value,
  size = 44,
  tone = "list",
  children,
  className,
}: {
  /** 0 à 1 */
  value: number;
  size?: number;
  tone?: Tone;
  children?: React.ReactNode;
  className?: string;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className={cn("transition-[stroke-dashoffset] duration-300 ease-out", TONE_CLASSES[tone].ring)}
        />
      </svg>
      {children && <span className="absolute text-[0.6875rem] font-semibold tabular-nums">{children}</span>}
    </span>
  );
}
