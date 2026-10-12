"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, ChefHat, Clock, RotateCcw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { thumbnailUrl } from "@/lib/image";
import { formatMinutes, parseSteps, scaleQuantity, totalMinutes } from "./meta";

// Vue lecture d'une recette, partagée entre la page propriétaire
// (/recipes/[id]) et la page publique d'un lien de partage (/shared/recipes/[token]).

export interface RecipeViewIngredient {
  id: string;
  name: string;
  quantity: string;
  unit: string | null;
}

export interface RecipeViewData {
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  steps: string;
  image: string | null;
  ingredients: RecipeViewIngredient[];
}

// Le mode cuisine pèse (minuteurs, plein écran, portail) : il ne se charge qu'à
// l'ouverture, et se précharge quand le navigateur est au repos.
const loadCookingMode = () => import("./CookingMode");
const CookingMode = dynamic(loadCookingMode, { ssr: false });

const PORTION_STEPS = [0.5, 1, 2, 3];

export function RecipeView({
  recipe,
  onBack,
  heroActions,
  heroOverlay,
  actions,
  autoCook,
}: {
  recipe: RecipeViewData;
  onBack?: () => void;
  /** Boutons ronds en haut à droite de la photo. */
  heroActions?: ReactNode;
  /** Éléments supplémentaires positionnés dans la zone photo (groupe `group/hero`). */
  heroOverlay?: ReactNode;
  /** Rangée d'actions sous le titre (planifier, courses…). */
  actions?: ReactNode;
  /** Ouvre le mode cuisine dès l'affichage (lien « Cuisiner » du catalogue). */
  autoCook?: boolean;
}) {
  const [cooking, setCooking] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [servingMultiplier, setServingMultiplier] = useState(1);

  const steps = parseSteps(recipe.steps);
  const ingredients = recipe.ingredients ?? [];
  const total = totalMinutes(recipe);

  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = idle ? idle(() => void loadCookingMode()) : window.setTimeout(() => void loadCookingMode(), 1500);
    return () => {
      if (!idle) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (autoCook && steps.length > 0) setCooking(true);
    // Une seule fois : l'ouverture automatique ne doit pas se rejouer après la fermeture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCook]);

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const amount = (ing: RecipeViewIngredient) =>
    `${scaleQuantity(ing.quantity, servingMultiplier)}${ing.unit ? ` ${ing.unit}` : ""}`;

  const closeCooking = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setCooking(false);
    // Le lien « Cuisiner » du catalogue ajoute ?cook=1 : on le retire pour qu'un rechargement ouvre la fiche.
    if (new URLSearchParams(window.location.search).has("cook")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const cookButton = steps.length > 0 && (
    <button
      type="button"
      onClick={() => setCooking(true)}
      className="group/cook flex h-14 w-full items-center justify-center gap-3 rounded-full bg-tone-meal px-8 text-xl font-extrabold text-on-tone shadow-surface transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:w-auto"
    >
      <ChefHat className="h-6 w-6" strokeWidth={2.5} />
      Cuisiner
      <span className="rounded-full bg-on-tone/[0.12] px-2.5 py-0.5 text-sm font-bold tabular-nums">
        {steps.length} étape{steps.length > 1 ? "s" : ""}
      </span>
    </button>
  );

  return (
    <article className="mx-auto w-full max-w-5xl space-y-5 md:space-y-6">
      {/* Photo (ou aplat safran sans photo) */}
      <div className="group/hero relative isolate overflow-hidden rounded-[1.75rem] md:rounded-[2rem]">
        {recipe.image ? (
          <div className="aspect-[4/3] w-full bg-tone-meal-soft sm:aspect-[16/9] md:aspect-[21/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl(recipe.image, 1400)}
              alt={recipe.title}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />
          </div>
        ) : (
          <div className="relative flex h-44 w-full items-center justify-center bg-tone-meal text-on-tone md:h-56">
            <svg aria-hidden viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
              <g fill="none" stroke="currentColor" strokeWidth="14">
                <circle cx="250" cy="96" r="82" opacity=".09" />
                <circle cx="250" cy="96" r="52" opacity=".11" />
                <circle cx="250" cy="96" r="22" opacity=".14" />
              </g>
            </svg>
            <ChefHat aria-hidden className="relative h-16 w-16 opacity-80" strokeWidth={1.75} />
          </div>
        )}

        {heroOverlay}

        {onBack && (
          <button
            type="button"
            aria-label="Retour"
            onClick={onBack}
            className="absolute left-3 top-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-card/90 text-foreground shadow-surface backdrop-blur-sm transition-[transform,background-color] duration-150 hover:bg-card active:scale-90 md:left-4 md:top-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {heroActions && <div className="absolute right-3 top-3 z-10 flex items-center gap-2 md:right-4 md:top-4">{heroActions}</div>}
      </div>

      {/* Titre, repères, Cuisiner */}
      <header className="space-y-3 px-1">
        <h1 className="font-display text-balance text-[2.25rem] leading-[1.02] md:text-[3.25rem]">{recipe.title}</h1>
        {recipe.description && <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">{recipe.description}</p>}
        <ul className="flex flex-wrap gap-2 pt-1">
          {total > 0 && (
            <li className="inline-flex h-9 items-center gap-1.5 rounded-full bg-tone-meal-soft px-3.5 text-sm font-bold tabular-nums text-tone-meal-ink">
              <Clock className="h-4 w-4" aria-hidden />
              {formatMinutes(total)}
            </li>
          )}
          {recipe.prepTime ? (
            <li className="inline-flex h-9 items-center rounded-full bg-secondary px-3.5 text-sm font-semibold tabular-nums text-secondary-foreground">
              Préparation {recipe.prepTime} min
            </li>
          ) : null}
          {recipe.cookTime ? (
            <li className="inline-flex h-9 items-center rounded-full bg-secondary px-3.5 text-sm font-semibold tabular-nums text-secondary-foreground">
              Cuisson {recipe.cookTime} min
            </li>
          ) : null}
          <li className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-sm font-semibold tabular-nums text-secondary-foreground">
            <Users className="h-4 w-4" aria-hidden />
            {recipe.servings} pers.
          </li>
        </ul>
        <div className="flex flex-col gap-3 pt-2 md:flex-row md:flex-wrap md:items-center">
          {cookButton}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* Ingrédients */}
        <section aria-labelledby="ingredients-title" className="rounded-[1.5rem] bg-card p-4 shadow-surface sm:p-5 md:sticky md:top-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="ingredients-title" className="font-display text-[1.75rem] leading-none">
              Ingrédients
            </h2>
            {checkedIngredients.size > 0 && (
              <button
                type="button"
                onClick={() => setCheckedIngredients(new Set())}
                aria-label="Tout décocher"
                title="Tout décocher"
                className="-m-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div role="group" aria-label="Nombre de portions" className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">Pour</span>
            <div className="flex flex-1 gap-1 rounded-full bg-secondary p-1">
              {PORTION_STEPS.map((mult) => {
                const n = mult === 1 ? recipe.servings : Math.round(recipe.servings * mult);
                const on = servingMultiplier === mult;
                return (
                  <button
                    key={mult}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${n} personnes`}
                    onClick={() => setServingMultiplier(mult)}
                    className={cn(
                      "h-11 flex-1 rounded-full text-base font-bold tabular-nums transition-[background-color,color] duration-150",
                      on ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <span className="text-sm font-semibold text-muted-foreground">pers.</span>
          </div>

          <ul className="space-y-0.5">
            {ingredients.map((ing) => {
              const on = checkedIngredients.has(ing.id);
              return (
                <li key={ing.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleIngredient(ing.id)}
                    className="flex min-h-14 w-full items-center gap-3.5 rounded-2xl px-2 text-left transition-[background-color,transform] duration-150 hover:bg-secondary/70 active:scale-[0.99]"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
                        on ? "border-tone-meal bg-tone-meal text-on-tone" : "border-foreground/25"
                      )}
                    >
                      {on && <Check className="h-4 w-4" strokeWidth={3.5} />}
                    </span>
                    <span className={cn("flex-1 text-base font-semibold leading-snug", on && "text-muted-foreground line-through")}>{ing.name}</span>
                    <span className={cn("shrink-0 text-base font-bold tabular-nums", on ? "text-muted-foreground/70 line-through" : "text-foreground")}>
                      {amount(ing)}
                    </span>
                  </button>
                </li>
              );
            })}
            {ingredients.length === 0 && <li className="py-3 text-sm text-muted-foreground">Aucun ingrédient renseigné.</li>}
          </ul>
        </section>

        {/* Préparation */}
        <section aria-labelledby="steps-title" className="px-1 md:px-0">
          <h2 id="steps-title" className="mb-4 font-display text-[1.75rem] leading-none">
            Préparation
          </h2>
          {steps.length === 0 ? (
            <p className="text-base text-muted-foreground">Aucune étape renseignée pour cette recette.</p>
          ) : (
            <ol className="space-y-5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tone-meal-soft text-xl text-tone-meal-ink tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-3 pt-1.5">
                    <p className="max-w-[65ch] text-pretty text-[1.0625rem] leading-relaxed text-foreground">{step.text}</p>
                    {step.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={step.image} alt={`Étape ${i + 1}`} loading="lazy" decoding="async" className="aspect-[16/10] w-full max-w-md rounded-2xl object-cover" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {cooking && steps.length > 0 && (
        <CookingMode
          title={recipe.title}
          steps={steps}
          ingredients={ingredients.map((ing) => ({ id: ing.id, name: ing.name, amount: amount(ing) }))}
          checked={checkedIngredients}
          onToggleIngredient={toggleIngredient}
          onResetIngredients={() => setCheckedIngredients(new Set())}
          onClose={closeCooking}
        />
      )}
    </article>
  );
}
