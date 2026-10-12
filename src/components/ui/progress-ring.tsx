import { cn } from "@/lib/utils";

/**
 * Anneau de progression (SVG, une seule propriété animée : stroke-dashoffset).
 * Décoratif : le parent expose le texte (« 3 sur 10 »). Posé sur un aplat, il
 * se dessine à l'encre.
 */
export function ProgressRing({
  value,
  size = 56,
  children,
  className,
}: {
  /** 0 à 1 */
  value: number;
  size?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center text-on-tone", className)} style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" opacity={0.18} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 700ms var(--spring-soft)" }}
        />
      </svg>
      {children && <span className="absolute text-xs font-extrabold tabular-nums">{children}</span>}
    </span>
  );
}
