"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Lock, Plus, X } from "lucide-react";
import { TONE_CLASSES, type Tone } from "@/components/ui/tone";
import type { KidDayValues, KidTrackerDto } from "@/lib/kidWeek";
import { cn } from "@/lib/utils";
import { DayForm, TrackerIcon } from "./DayForm";
import type { WeekDay } from "./WeekTable";

// Sept jours, quatre teintes du design system : l'enfant repère « son » jour par la couleur.
const DAY_TONES: Tone[] = ["todo", "list", "meal", "agenda", "todo", "list", "meal"];
const HOLD_MS = 1000;

/** `inert` n'est pas encore connu de React 18 : on pose l'attribut à la main. */
const inertWhen = (on: boolean) => ({ inert: on ? "" : undefined }) as Record<string, unknown>;

/** Aperçu d'un jour : première image de chaque rubrique renseignée (cinq au plus). */
function preview(trackers: KidTrackerDto[], values: KidDayValues) {
  const out: Array<{ key: string; icon?: string; number?: number }> = [];
  for (const t of trackers) {
    const v = values[t.id];
    if (v === undefined) continue;
    if (typeof v === "number") out.push({ key: t.id, number: v });
    else {
      const o = t.options.find((x) => x.id === v[0]);
      if (o) out.push({ key: t.id, icon: o.icon });
    }
  }
  return out;
}

/**
 * Sortie du mode enfant : appui long de 1 s (ou Entrée/Espace maintenu) sur un
 * cadenas discret. Un anneau se remplit pendant l'appui.
 */
function ExitLock({ onExit }: { onExit: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = () => {
    setHolding(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setHolding(false);
      onExit();
    }, HOLD_MS);
  };
  const stop = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={stop}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Quitter le mode enfant : maintenir appuyé une seconde"
      title="Maintenir appuyé pour quitter le mode enfant"
      className={cn(
        "relative flex h-11 w-11 select-none items-center justify-center rounded-full bg-secondary text-muted-foreground [-webkit-touch-callout:none]",
        "transition-[opacity,background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        holding ? "bg-ink text-ink-foreground opacity-100" : "opacity-60 hover:opacity-100"
      )}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={holding ? 0 : 100}
          style={{ transition: holding ? `stroke-dashoffset ${HOLD_MS}ms linear` : "none" }}
        />
      </svg>
      <Lock className="h-4 w-4" aria-hidden />
    </button>
  );
}

/**
 * Mode enfant plein écran : la semaine en cours, de grands boutons libellés.
 * Règles validées par Alexandre :
 * - un nouvel appui sur un choix pris ne le désélectionne pas ;
 * - toucher le fond ne ferme rien : seuls « Fini ! » et la croix ferment un jour,
 *   seul l'appui long sur le cadenas quitte le mode ;
 * - les images des choix ont toujours un libellé visible.
 */
export function KidMode({
  childName,
  days,
  trackers,
  values,
  loading,
  onChange,
  onExit,
  rangeLabel,
}: {
  childName: string;
  days: WeekDay[];
  trackers: KidTrackerDto[];
  values: Record<string, KidDayValues>;
  loading: boolean;
  onChange: (date: string, trackerId: string, next: string[] | number | null) => Promise<boolean>;
  onExit: () => void;
  rangeLabel: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const panelTitle = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const editIndex = editing ? days.findIndex((d) => d.date === editing) : -1;
  const editTone = editIndex >= 0 ? TONE_CLASSES[DAY_TONES[editIndex]] : null;

  // Le mode enfant vit hors de l'app (portail sur <body>) et le reste de la page devient inerte :
  // ni Tab ni lecteur d'écran n'atteignent la vue parent derrière.
  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const others = Array.from(document.body.children).filter((c) => c !== el);
    const wasInert = others.map((c) => c.hasAttribute("inert"));
    others.forEach((c) => c.setAttribute("inert", ""));
    setHost(el);
    return () => {
      others.forEach((c, i) => {
        if (!wasInert[i]) c.removeAttribute("inert");
      });
      el.remove();
    };
  }, []);

  useEffect(() => {
    if (editing) panelTitle.current?.focus();
  }, [editing]);

  const close = () => {
    setEditing(null);
    opener.current?.focus();
  };

  const change = async (date: string, id: string, next: string[] | number | null) => {
    const ok = await onChange(date, id, next);
    setFailed(!ok);
  };

  if (!host) return null;
  return createPortal(
    <div
      role="region"
      aria-label="Mode enfant"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-background px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] md:px-8"
    >
      <div {...inertWhen(!!editing)} className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-10">
        <ExitLock onExit={onExit} />
      </div>

      <div {...inertWhen(!!editing)} className="mx-auto max-w-5xl">
        <header className="mb-5 pr-14 text-center md:pr-0">
          <p className="text-base font-bold text-muted-foreground">Semainier</p>
          <h1 className="font-display text-4xl md:text-5xl">{childName}</h1>
          <p className="mt-1 text-base text-muted-foreground">{rangeLabel}</p>
        </header>

        {!loading && trackers.length === 0 ? (
          <p className="mx-auto max-w-sm py-16 text-center text-lg text-muted-foreground">
            Il n&apos;y a rien à remplir pour l&apos;instant. Un grand peut créer des rubriques.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((d, i) => {
              const tone = TONE_CLASSES[DAY_TONES[i]];
              const shown = preview(trackers, values[d.date] ?? {});
              return (
                <li key={d.date} className={i === 6 ? "col-span-2 sm:col-span-1" : undefined}>
                  <button
                    type="button"
                    onClick={(e) => {
                      opener.current = e.currentTarget;
                      setEditing(d.date);
                    }}
                    aria-label={`${format(d.day, "EEEE d MMMM", { locale: fr })}${d.today ? ", aujourd'hui" : ""}${shown.length === 0 ? ", à remplir" : ""}`}
                    className={cn(
                      "flex min-h-[10.5rem] w-full flex-col overflow-hidden rounded-3xl text-left shadow-surface",
                      "transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                      d.today && "ring-4 ring-ink ring-offset-2 ring-offset-background"
                    )}
                  >
                    <span className={cn("flex items-baseline justify-between gap-2 px-4 py-2.5 text-on-tone", tone.solid)}>
                      <span className="min-w-0">
                        <span className="block truncate text-lg font-extrabold capitalize leading-tight">{format(d.day, "EEEE", { locale: fr })}</span>
                        {d.today && <span className="block text-sm font-bold leading-tight">Aujourd&apos;hui</span>}
                      </span>
                      <span className="font-display text-3xl tabular-nums">{format(d.day, "d")}</span>
                    </span>
                    <span className={cn("flex flex-1 flex-wrap content-center items-center justify-center gap-2 p-3", tone.soft)}>
                      {shown.length === 0 ? (
                        <span className={cn("flex h-14 w-14 items-center justify-center rounded-full text-on-tone", tone.solid)}>
                          <Plus className="h-7 w-7" strokeWidth={3} aria-hidden />
                        </span>
                      ) : (
                        shown.slice(0, 6).map((p) =>
                          p.icon ? (
                            <TrackerIcon key={p.key} id={p.icon} size={40} />
                          ) : (
                            <span key={p.key} className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full bg-card px-2 text-xl font-extrabold tabular-nums">
                              {p.number}
                            </span>
                          )
                        )
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && editTone && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/55 sm:items-center sm:p-6">
          {/* Le fond ne réagit pas : un doigt qui déborde ne ferme rien. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kid-day-title"
            className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-card shadow-xl animate-[sheet-in_200ms_ease-out] sm:max-h-[90dvh] sm:rounded-[2rem]"
          >
            <div className={cn("flex shrink-0 items-center gap-3 px-5 py-3 text-on-tone", editTone.solid)}>
              <h2 id="kid-day-title" ref={panelTitle} tabIndex={-1} className="min-w-0 flex-1 truncate font-display text-3xl outline-none first-letter:uppercase">
                {format(days[editIndex].day, "EEEE d MMMM", { locale: fr })}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-on-tone/15 transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tone"
              >
                <X className="h-6 w-6" strokeWidth={3} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
              <DayForm kid trackers={trackers} values={values[editing] ?? {}} onChange={(id, next) => change(editing, id, next)} />
            </div>
            <div className="shrink-0 border-t border-border px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              {failed && (
                <p role="alert" className="mb-2 text-center text-base font-bold text-destructive">
                  Oups, ça n&apos;a pas été enregistré. Réessaie.
                </p>
              )}
              <button
                type="button"
                onClick={close}
                className={cn(
                  "h-14 w-full rounded-full text-xl font-extrabold text-on-tone transition-transform active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  editTone.solid
                )}
              >
                Fini !
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    host
  );
}
