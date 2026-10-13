"use client";

import { useEffect, useRef } from "react";
import { Check, Eraser, Minus, Plus } from "lucide-react";
import { KidIcon } from "@/components/kids/icons";
import { isKidIconId } from "@/lib/kidIconIds";
import { KID_COUNT_MAX, type KidDayValues, type KidOptionDto, type KidTrackerDto } from "@/lib/kidWeek";
import { cn } from "@/lib/utils";

// Un double appui rapide d'enfant ne doit pas annuler le choix qu'il vient de faire.
const DOUBLE_TAP_MS = 450;

export function TrackerIcon({ id, size, className }: { id: string; size: number; className?: string }) {
  return isKidIconId(id) ? <KidIcon id={id} size={size} decorative className={className} /> : null;
}

/**
 * Bouton de choix : image et libellé toujours visibles, coche quand il est pris
 * (l'état ne dépend pas de la couleur seule). 88 px de haut en saisie parent,
 * 120 px en mode enfant.
 */
function OptionButton({
  option,
  selected,
  kid,
  onPick,
}: {
  option: KidOptionDto;
  selected: boolean;
  kid: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1.5 text-center font-bold leading-tight",
        "transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.96]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        kid ? "min-h-[7.5rem] py-3 text-base" : "min-h-[5.5rem] py-2 text-sm",
        selected
          ? "border-tone-list-ink bg-tone-list-soft text-foreground"
          : "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/70"
      )}
    >
      <TrackerIcon id={option.icon} size={kid ? 56 : 44} />
      <span className="max-w-full break-words [overflow-wrap:anywhere]">{option.label}</span>
      {selected && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tone-list-ink text-card"
        >
          <Check className="h-3 w-3" strokeWidth={4} />
        </span>
      )}
    </button>
  );
}

export interface DayFormProps {
  trackers: KidTrackerDto[];
  values: KidDayValues;
  /** Écrit la rubrique : tableau d'identifiants de choix, nombre, ou null pour effacer. */
  onChange: (trackerId: string, next: string[] | number | null) => void;
  kid?: boolean;
  /** Rubrique à amener à l'écran à l'ouverture (la cellule touchée dans la semaine). */
  focusTrackerId?: string | null;
}

/**
 * Saisie d'un jour : une section par rubrique active, selon son type.
 * - choix unique : un nouvel appui sur le choix pris ne l'efface pas ;
 * - choix multiples : un appui coche ou décoche (en mode enfant, un second appui
 *   dans les 450 ms est ignoré) ;
 * - compteur : − et + de 56 px en mode enfant.
 * En mode enfant, aucun bouton « Effacer » : on ne retire rien par mégarde.
 */
export function DayForm({ trackers, values, onChange, kid = false, focusTrackerId }: DayFormProps) {
  const lastTap = useRef<Record<string, number>>({});
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!focusTrackerId) return;
    refs.current[focusTrackerId]?.scrollIntoView({ block: "start" });
  }, [focusTrackerId]);

  return (
    <div className="space-y-6">
      {trackers.map((t) => {
        const raw = values[t.id];
        const chosen = Array.isArray(raw) ? raw : [];
        const count = typeof raw === "number" ? raw : null;
        const filled = raw !== undefined;
        const options = t.options.filter((o) => o.active || chosen.includes(o.id));
        const headingId = `kid-field-${t.id}`;

        const pickSingle = (id: string) => {
          if (chosen.length === 1 && chosen[0] === id) return;
          onChange(t.id, [id]);
        };
        const toggleMulti = (id: string) => {
          if (kid) {
            const now = Date.now();
            const key = `${t.id}:${id}`;
            if (now - (lastTap.current[key] ?? 0) < DOUBLE_TAP_MS) return;
            lastTap.current[key] = now;
          }
          const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
          onChange(t.id, next.length > 0 ? next : null);
        };
        const setCount = (n: number) => onChange(t.id, Math.min(KID_COUNT_MAX, Math.max(0, n)));

        return (
          <section
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            aria-labelledby={headingId}
            className="scroll-mt-2"
          >
            <div className="mb-2 flex min-h-[2.75rem] items-center gap-2.5">
              <TrackerIcon id={t.icon} size={kid ? 36 : 28} />
              <h3 id={headingId} className={cn("min-w-0 flex-1 font-extrabold [overflow-wrap:anywhere]", kid ? "text-2xl" : "text-lg")}>
                {t.label}
              </h3>
              {!kid && filled && (
                <button
                  type="button"
                  onClick={() => onChange(t.id, null)}
                  aria-label={`Effacer ${t.label}`}
                  title="Effacer"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-70 transition-[opacity,background-color] hover:bg-secondary hover:opacity-100 focus-visible:opacity-100 touch:opacity-100"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {t.kind === "count" ? (
              <div className="flex items-center justify-center gap-5 rounded-2xl bg-secondary py-3">
                <button
                  type="button"
                  onClick={() => setCount((count ?? 0) - 1)}
                  disabled={(count ?? 0) <= 0}
                  aria-label={`Un de moins pour ${t.label}`}
                  className={cn(
                    "flex items-center justify-center rounded-full bg-card shadow-surface transition-transform active:scale-90 disabled:opacity-40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    kid ? "h-16 w-16" : "h-12 w-12"
                  )}
                >
                  <Minus className={kid ? "h-7 w-7" : "h-5 w-5"} strokeWidth={3} />
                </button>
                <output
                  aria-live="polite"
                  aria-label={`${t.label} : ${count ?? 0}`}
                  className={cn("min-w-[3ch] text-center font-display tabular-nums", kid ? "text-6xl" : "text-4xl", count === null && "text-muted-foreground")}
                >
                  {count ?? 0}
                </output>
                <button
                  type="button"
                  onClick={() => setCount((count ?? 0) + 1)}
                  disabled={(count ?? 0) >= KID_COUNT_MAX}
                  aria-label={`Un de plus pour ${t.label}`}
                  className={cn(
                    "flex items-center justify-center rounded-full bg-tone-list text-on-tone shadow-surface transition-transform active:scale-90 disabled:opacity-40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    kid ? "h-16 w-16" : "h-12 w-12"
                  )}
                >
                  <Plus className={kid ? "h-7 w-7" : "h-5 w-5"} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <div className={cn("grid gap-2", kid ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4")}>
                {options.map((o) => (
                  <OptionButton
                    key={o.id}
                    option={o}
                    kid={kid}
                    selected={chosen.includes(o.id)}
                    onPick={() => (t.kind === "multi" ? toggleMulti(o.id) : pickSingle(o.id))}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
