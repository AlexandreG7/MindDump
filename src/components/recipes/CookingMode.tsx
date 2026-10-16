"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Maximize, Minimize, Moon, RotateCcw, Sun, Timer, X } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { cn } from "@/lib/utils";
import { detectTimers, type RecipeStep } from "./meta";

/**
 * Mode cuisine : plein écran, pensé pour le plan de travail (téléphone posé,
 * mains sales). Grosse typographie, cibles de 56 à 64 px, écran maintenu
 * allumé, ingrédients cochables, minuteurs d'un appui pour les durées citées
 * dans l'étape. Chargé en différé (voir RecipeView) : il pèse sur l'ouverture,
 * pas sur l'affichage de la fiche.
 */

export interface CookIngredient {
  id: string;
  name: string;
  /** Quantité déjà mise à l'échelle des portions choisies. */
  amount: string;
}

interface RunningTimer {
  id: number;
  step: number;
  label: string;
  total: number;
  endsAt: number;
  left: number;
  done: boolean;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function CookingMode({
  title,
  steps,
  ingredients,
  checked,
  onToggleIngredient,
  onResetIngredients,
  startAt = 0,
  onClose,
}: {
  title: string;
  steps: RecipeStep[];
  ingredients: CookIngredient[];
  checked: Set<string>;
  onToggleIngredient: (id: string) => void;
  onResetIngredients: () => void;
  startAt?: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState(Math.max(0, Math.min(startAt, steps.length - 1)));
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [panel, setPanel] = useState<"steps" | "ingredients">("steps");
  const [awake, setAwake] = useState(false);
  // Le bouton clair/sombre n'agit que le temps de la session de cuisine : la
  // préférence enregistrée (y compris « Système ») est rendue à la fermeture.
  const { resolvedTheme, setSessionTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  useEffect(() => () => setSessionTheme(null), [setSessionTheme]);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const touch = useRef({ x: 0, y: 0 });
  const audio = useRef<AudioContext | null>(null);
  const timerId = useRef(0);
  const [host, setHost] = useState<HTMLElement | null>(null);

  const go = useCallback(
    (to: number) => {
      setStep((cur) => {
        const next = Math.max(0, Math.min(steps.length - 1, to));
        if (next !== cur) setDir(next > cur ? "next" : "prev");
        return next;
      });
      setPanel("steps");
    },
    [steps.length]
  );

  // Portail dans <body> : le reste de l'app devient inerte (focus et lecteur
  // d'écran restent dans le mode cuisine), et la page dessous ne défile plus.
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!host) return;
    const inerted: HTMLElement[] = [];
    const root = rootRef.current;
    Array.from(document.body.children).forEach((el) => {
      if (el instanceof HTMLElement && !el.contains(root) && !el.hasAttribute("inert") && el.tagName !== "SCRIPT") {
        el.setAttribute("inert", "");
        inerted.push(el);
      }
    });
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.focus();
    return () => {
      inerted.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [host]);

  // Écran maintenu allumé (si le navigateur sait faire), rétabli au retour sur l'onglet.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          lock = await navigator.wakeLock.request("screen");
          if (cancelled) lock.release().catch(() => {});
          else {
            setAwake(true);
            lock.addEventListener("release", () => setAwake(false));
          }
        }
      } catch {
        setAwake(false);
      }
    };
    acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    setCanFullscreen(!!document.fullscreenEnabled);
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Clavier : flèches et espace pour avancer, Échap pour fermer (ou quitter le plein écran).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const onControl = el.closest?.("button, a, input, textarea, [role=checkbox]");
      if (e.key === "ArrowRight" || (e.key === " " && !onControl)) {
        e.preventDefault();
        setStep((s) => {
          const n = Math.min(s + 1, steps.length - 1);
          if (n !== s) setDir("next");
          return n;
        });
        setPanel("steps");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => {
          const n = Math.max(s - 1, 0);
          if (n !== s) setDir("prev");
          return n;
        });
        setPanel("steps");
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        else onClose();
      } else if (e.key === "Tab") {
        // Piège de focus : Tab et Maj+Tab bouclent dans la modale.
        const root = rootRef.current;
        if (!root) return;
        const items = Array.from(
          root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
        ).filter((n) => n.getClientRects().length > 0);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === root || !root.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !root.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onClose]);

  // Minuteurs : le temps restant se déduit de l'heure de fin, donc reste juste
  // même si le navigateur ralentit l'onglet.
  const beep = useCallback(() => {
    try {
      navigator.vibrate?.([400, 200, 400, 200, 400]);
      const ctx = audio.current;
      if (!ctx) return;
      [0, 0.45, 0.9].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.32);
      });
    } catch {}
  }, []);

  // Un seul intervalle tant qu'un minuteur court ; il ne dépend pas de la liste.
  const hasRunning = timers.some((t) => !t.done);
  useEffect(() => {
    if (!hasRunning) return;
    const tick = window.setInterval(() => {
      const now = Date.now();
      setTimers((list) =>
        list.map((t) => {
          if (t.done) return t;
          const left = Math.max(0, Math.round((t.endsAt - now) / 1000));
          return left === t.left ? t : { ...t, left, done: left === 0 };
        })
      );
    }, 500);
    return () => window.clearInterval(tick);
  }, [hasRunning]);

  // Fin d'un minuteur : détectée en comparant les minuteurs terminés à ceux déjà annoncés.
  const alerted = useRef<Set<number>>(new Set());
  useEffect(() => {
    const fresh = timers.filter((t) => t.done && !alerted.current.has(t.id));
    if (fresh.length === 0) return;
    fresh.forEach((t) => alerted.current.add(t.id));
    beep();
  }, [timers, beep]);

  useEffect(() => () => void audio.current?.close().catch(() => {}), []);

  const startTimer = (seconds: number, label: string) => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !audio.current) audio.current = new Ctx();
      audio.current?.resume();
    } catch {}
    setTimers((list) => [
      ...list,
      { id: ++timerId.current, step, label, total: seconds, endsAt: Date.now() + seconds * 1000, left: seconds, done: false },
    ]);
  };
  const stopTimer = (id: number) => setTimers((list) => list.filter((t) => t.id !== id));

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {}
  };

  const current: RecipeStep | undefined = steps[step];
  const isLast = step === steps.length - 1;
  const durations = useMemo(() => detectTimers(current?.text ?? ""), [current?.text]);
  // Sans étape il n'y a rien à cuisiner : on referme.
  useEffect(() => {
    if (steps.length === 0) onClose();
  }, [steps.length, onClose]);
  const checkedCount = ingredients.filter((i) => checked.has(i.id)).length;

  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(step + (dx < 0 ? 1 : -1));
  };

  if (!current) return null;

  const ingredientList = (
    <ul className="space-y-1.5">
      {ingredients.map((ing) => {
        const on = checked.has(ing.id);
        return (
          <li key={ing.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggleIngredient(ing.id)}
              className={cn(
                "flex min-h-16 w-full items-center gap-4 rounded-2xl px-4 text-left transition-[background-color,transform] duration-150 active:scale-[0.99]",
                on ? "bg-tone-meal-soft" : "bg-secondary/70 hover:bg-secondary"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
                  on ? "border-tone-meal bg-tone-meal text-on-tone" : "border-foreground/30"
                )}
              >
                {on && <Check className="h-5 w-5" strokeWidth={3.5} />}
              </span>
              <span className={cn("flex-1 text-xl font-semibold leading-tight", on && "text-muted-foreground line-through decoration-2")}>{ing.name}</span>
              <span className={cn("shrink-0 text-xl font-extrabold tabular-nums", on && "text-muted-foreground")}>{ing.amount}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const ingredientsHeader = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-3xl leading-none">Ingrédients</h2>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold tabular-nums text-muted-foreground">
          {checkedCount} / {ingredients.length}
        </span>
        {checkedCount > 0 && (
          <button
            type="button"
            onClick={onResetIngredients}
            aria-label="Tout décocher"
            className="flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );

  const ui = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Mode cuisine : ${title}`}
      tabIndex={-1}
      className="fixed inset-0 z-9999 flex flex-col bg-background text-foreground outline-hidden"
    >
      {/* Annonce stable pour les lecteurs d'écran : le conteneur n'est jamais remonté, seul son texte change. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        Étape {step + 1} sur {steps.length}. {current.text}
      </p>

      {/* Barre du haut */}
      <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le mode cuisine"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary transition-[background-color,transform] duration-150 hover:bg-accent active:scale-90"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-base font-bold text-muted-foreground">{title}</p>
          {awake && <p className="text-xs font-medium text-muted-foreground">Écran maintenu allumé</p>}
        </div>
        <button
          type="button"
          onClick={() => setSessionTheme(dark ? "light" : "dark")}
          aria-label={dark ? "Passer en thème clair" : "Passer en thème sombre"}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary transition-[background-color,transform] duration-150 hover:bg-accent active:scale-90"
        >
          {dark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
        </button>
        {canFullscreen ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary transition-[background-color,transform] duration-150 hover:bg-accent active:scale-90"
          >
            {fullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
          </button>
        ) : (
          <span className="w-2 shrink-0" />
        )}
      </div>

      {/* Étapes / Ingrédients (téléphone) ; sur grand écran, les deux côte à côte */}
      <div role="tablist" aria-label="Affichage" className="mx-3 mb-1 mt-1 flex shrink-0 gap-1 rounded-full bg-secondary p-1 lg:hidden">
        {(
          [
            ["steps", `Étape ${step + 1} / ${steps.length}`],
            ["ingredients", `Ingrédients ${checkedCount}/${ingredients.length}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            id={`cook-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={panel === key}
            aria-controls={`cook-panel-${key}`}
            onClick={() => setPanel(key)}
            className={cn(
              "h-12 flex-1 rounded-full px-3 text-base font-bold tabular-nums transition-[background-color,color] duration-150",
              panel === key ? "bg-ink text-ink-foreground" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Progression : un segment par étape, touchable */}
      <div className={cn("flex shrink-0 gap-1.5 px-4", panel === "ingredients" && "max-lg:hidden")} role="group" aria-label="Progression">
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Aller à l'étape ${i + 1}`}
            aria-current={i === step ? "step" : undefined}
            className="flex h-11 flex-1 items-center"
          >
            <span
              className={cn(
                "h-2 w-full rounded-full transition-colors duration-200",
                i === step ? "bg-tone-meal" : i < step ? "bg-foreground/45" : "bg-foreground/15"
              )}
            />
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Étape */}
        <div
          id="cook-panel-steps"
          role="tabpanel"
          aria-labelledby="cook-tab-steps"
          className={cn("min-w-0 flex-1 overflow-y-auto overscroll-contain", panel === "ingredients" && "max-lg:hidden")}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div key={step} data-dir={dir} className="cook-step mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-5 px-5 py-5 lg:px-10">
            <div className="flex items-center gap-3">
              <span className="font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tone-meal text-3xl text-on-tone tabular-nums">{step + 1}</span>
              <p className="text-lg font-bold text-muted-foreground">
                Étape {step + 1} sur {steps.length}
              </p>
            </div>

            {current.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.image} alt={`Étape ${step + 1}`} className="max-h-[30vh] w-full rounded-3xl object-cover lg:max-h-[36vh]" />
            )}

            <p className="text-pretty text-[1.75rem] font-semibold leading-[1.28] tracking-[-0.012em] sm:text-[2.125rem] lg:text-[2.75rem] lg:leading-[1.2]">
              {current.text}
            </p>

            {durations.length > 0 && (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {durations.map((d) => {
                  const running = timers.find((t) => t.step === step && t.total === d.seconds && !t.done);
                  return (
                    <button
                      key={d.seconds}
                      type="button"
                      onClick={() => (running ? stopTimer(running.id) : startTimer(d.seconds, d.label))}
                      aria-pressed={!!running}
                      className={cn(
                        "inline-flex h-14 items-center gap-2.5 rounded-full px-6 text-lg font-extrabold tabular-nums transition-[background-color,transform] duration-150 active:scale-95",
                        running ? "bg-ink text-ink-foreground" : "bg-tone-meal-soft text-tone-meal-ink hover:brightness-95"
                      )}
                    >
                      <Timer className="h-6 w-6" />
                      {running ? `${clock(running.left)} · arrêter` : `Minuteur ${d.label}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Ingrédients : onglet sur téléphone, colonne fixe sur grand écran */}
        <div
          id="cook-panel-ingredients"
          role="tabpanel"
          aria-labelledby="cook-tab-ingredients"
          className={cn(
            "min-w-0 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 lg:w-104 lg:shrink-0 lg:border-l lg:border-border lg:px-6",
            panel === "ingredients" ? "flex-1" : "max-lg:hidden"
          )}
        >
          {ingredientsHeader}
          {ingredientList}
        </div>
      </div>

      {/* Minuteurs en cours */}
      {timers.length > 0 && (
        <div className="flex shrink-0 flex-col gap-2 px-3 pb-2 pt-1">
          {timers.map((t) => (
            <div
              key={t.id}
              role={t.done ? "alert" : undefined}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-2xl px-4",
                t.done ? "bg-tone-meal text-on-tone motion-safe:animate-pulse" : "bg-ink text-ink-foreground"
              )}
            >
              <Timer className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-base font-bold">
                {t.done ? "Minuteur terminé" : `Étape ${t.step + 1}`}
                <span className="ml-2 font-medium opacity-80">{t.label}</span>
              </span>
              {!t.done && <span className="text-3xl font-extrabold tabular-nums">{clock(t.left)}</span>}
              <button
                type="button"
                onClick={() => stopTimer(t.id)}
                aria-label={t.done ? "Couper l'alerte" : "Arrêter le minuteur"}
                className={cn(
                  "flex h-14 shrink-0 items-center justify-center rounded-full font-bold transition-transform active:scale-90",
                  t.done ? "bg-on-tone px-6 text-tone-meal" : "w-14 bg-ink-foreground/15"
                )}
              >
                {t.done ? "OK" : <X className="h-6 w-6" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="grid shrink-0 grid-cols-[1fr_2fr] gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          className="flex h-16 items-center justify-center gap-1 rounded-2xl bg-secondary text-lg font-extrabold transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-35"
        >
          <ChevronLeft className="h-7 w-7" />
          Précédent
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-tone-list text-xl font-extrabold text-on-tone transition-transform duration-150 active:scale-[0.97]"
          >
            <Check className="h-7 w-7" strokeWidth={3} />
            Terminé
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(step + 1)}
            className="flex h-16 items-center justify-center gap-1 rounded-2xl bg-tone-meal text-xl font-extrabold text-on-tone transition-transform duration-150 active:scale-[0.97]"
          >
            Suivant
            <ChevronRight className="h-7 w-7" strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );

  return host ? createPortal(ui, host) : null;
}
