"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  UtensilsCrossed,
  Check,
  X,
  Maximize,
  Minimize,
  CalendarPlus,
  ShoppingCart,
  BookMarked,
} from "lucide-react";

interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

interface Step {
  text: string;
  image: string | null;
}

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  steps: string;
  image: string | null;
  planned: boolean;
  inCatalog: boolean;
  ingredients: Ingredient[];
}

function parseSteps(raw: string): Step[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s: string | { text: string; image?: string }) =>
      typeof s === "string"
        ? { text: s, image: null }
        : { text: s.text, image: s.image || null }
    );
  } catch {
    return [];
  }
}

function CookingMode({
  recipe,
  steps,
  onClose,
}: {
  recipe: Recipe;
  steps: Step[];
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Wake Lock to keep screen on
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {}
    };
    acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      wakeLock?.release();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setStep((s) => Math.min(s + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => Math.max(s - 1, 0));
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onClose]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current?.requestFullscreen();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && step < steps.length - 1) setStep(step + 1);
      if (dx > 0 && step > 0) setStep(step - 1);
    }
  };

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      ref={containerRef}
      className="cooking-mode"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="cooking-topbar">
        <button onClick={onClose} className="cooking-btn">
          <X className="h-5 w-5" />
        </button>
        <span className="cooking-title">{recipe.title}</span>
        <button onClick={toggleFullscreen} className="cooking-btn">
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="cooking-progress">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`cooking-progress-dot ${i <= step ? "active" : ""}`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="cooking-content">
        {current.image && (
          <div className="cooking-image-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.image}
              alt={`Étape ${step + 1}`}
              className="cooking-image"
            />
          </div>
        )}

        <div className="cooking-step-info">
          <span className="cooking-step-badge">{step + 1}</span>
          <span className="cooking-step-label">
            Étape {step + 1} / {steps.length}
          </span>
        </div>

        <div className="cooking-text">{current.text}</div>
      </div>

      {/* Navigation */}
      <div className="cooking-nav">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="cooking-nav-btn prev"
        >
          <ChevronLeft className="h-6 w-6" />
          <span>Précédent</span>
        </button>

        {isLast ? (
          <button onClick={onClose} className="cooking-nav-btn done">
            <Check className="h-6 w-6" />
            <span>Terminé</span>
          </button>
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            className="cooking-nav-btn next"
          >
            <span>Suivant</span>
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isReady } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [cookingMode, setCookingMode] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [servingMultiplier, setServingMultiplier] = useState(1);

  const fetchRecipe = useCallback(() => {
    fetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then(setRecipe);
  }, [id]);

  useEffect(() => {
    if (isReady && id) fetchRecipe();
  }, [isReady, id, fetchRecipe]);

  if (!isReady || !recipe) return null;

  const steps = parseSteps(recipe.steps);

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const multiplyQuantity = (qty: string): string => {
    if (servingMultiplier === 1) return qty;
    const num = parseFloat(qty.replace(",", "."));
    if (isNaN(num)) return qty;
    const result = num * servingMultiplier;
    return result % 1 === 0 ? String(result) : result.toFixed(1).replace(".", ",");
  };

  const togglePlanned = async () => {
    await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planned: !recipe.planned }),
    });
    fetchRecipe();
  };

  const toggleCatalog = async () => {
    await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inCatalog: !recipe.inCatalog }),
    });
    fetchRecipe();
  };

  const addToShoppingList = async () => {
    await fetch(`/api/recipes/${id}/to-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: null }),
    });
    fetchRecipe();
  };

  const closeCookingMode = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setCookingMode(false);
  };

  if (cookingMode && steps.length > 0) {
    return <CookingMode recipe={recipe} steps={steps} onClose={closeCookingMode} />;
  }

  // ── Overview mode ──
  return (
    <div className="recipe-detail-page">
      {/* Hero */}
      <div className="relative">
        {recipe.image ? (
          <div className="recipe-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.image}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
        ) : (
          <div className="recipe-hero bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
            <UtensilsCrossed className="h-20 w-20 text-orange-300" />
          </div>
        )}

        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 p-2.5 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={toggleCatalog}
            className={`p-2.5 rounded-full backdrop-blur-sm transition-colors ${
              recipe.inCatalog
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-black/30 text-white hover:bg-black/50"
            }`}
            title={recipe.inCatalog ? "Retirer du catalogue" : "Ajouter au catalogue"}
          >
            <BookMarked className="h-5 w-5" />
          </button>
          <button
            onClick={togglePlanned}
            className={`p-2.5 rounded-full backdrop-blur-sm transition-colors ${
              recipe.planned
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-black/30 text-white hover:bg-black/50"
            }`}
            title={recipe.planned ? "Retirer du planning" : "Planifier"}
          >
            <CalendarPlus className="h-5 w-5" />
          </button>
          <button
            onClick={addToShoppingList}
            className="p-2.5 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
            title="Ajouter aux courses"
          >
            <ShoppingCart className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-10">
          <h1
            className={`handwritten font-bold leading-tight ${
              recipe.image ? "text-white text-4xl md:text-5xl" : "text-foreground text-3xl md:text-4xl"
            }`}
          >
            {recipe.title}
          </h1>
          {recipe.description && (
            <p
              className={`mt-2 text-sm md:text-base leading-relaxed max-w-2xl ${
                recipe.image ? "text-white/80" : "text-muted-foreground"
              }`}
            >
              {recipe.description}
            </p>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div className="recipe-info-bar">
        {totalTime > 0 && (
          <div className="recipe-info-chip">
            <Clock className="h-4 w-4" />
            <span>{totalTime} min</span>
          </div>
        )}
        {recipe.prepTime && (
          <div className="recipe-info-chip">
            <span className="text-xs text-muted-foreground">Prep</span>
            <span>{recipe.prepTime} min</span>
          </div>
        )}
        {recipe.cookTime && (
          <div className="recipe-info-chip">
            <span className="text-xs text-muted-foreground">Cuisson</span>
            <span>{recipe.cookTime} min</span>
          </div>
        )}
        <div className="recipe-info-chip">
          <Users className="h-4 w-4" />
          <span>{recipe.servings}</span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="recipe-body">
        {/* Sidebar: ingredients */}
        <div className="recipe-sidebar">
          {/* Serving adjuster */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Portions</span>
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
                {[0.5, 1, 2, 3].map((mult) => (
                  <button
                    key={mult}
                    onClick={() => setServingMultiplier(mult)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      servingMultiplier === mult
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mult === 1
                      ? recipe.servings
                      : Math.round(recipe.servings * mult)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Ingrédients
          </h2>
          <div className="space-y-0.5">
            {recipe.ingredients.map((ing) => (
              <button
                key={ing.id}
                onClick={() => toggleIngredient(ing.id)}
                className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors text-left ${
                  checkedIngredients.has(ing.id)
                    ? "bg-green-50 text-muted-foreground"
                    : "hover:bg-secondary"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    checkedIngredients.has(ing.id)
                      ? "bg-green-500 border-green-500"
                      : "border-border"
                  }`}
                >
                  {checkedIngredients.has(ing.id) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <span
                  className={`flex-1 text-sm ${
                    checkedIngredients.has(ing.id) ? "line-through" : ""
                  }`}
                >
                  {ing.name}
                </span>
                <span
                  className={`text-sm tabular-nums shrink-0 ${
                    checkedIngredients.has(ing.id)
                      ? "text-muted-foreground/50 line-through"
                      : "text-muted-foreground"
                  }`}
                >
                  {multiplyQuantity(ing.quantity)}
                  {ing.unit ? ` ${ing.unit}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main: steps */}
        <div className="recipe-main">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Préparation — {steps.length} étape{steps.length > 1 ? "s" : ""}
            </h2>
            {steps.length > 0 && (
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => setCookingMode(true)}
              >
                <UtensilsCrossed className="h-4 w-4 mr-1.5" />
                Cuisiner
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {steps.map((step, i) => (
              <div
                key={i}
                className="w-full flex gap-4 p-4 rounded-xl bg-secondary/50 text-left"
              >
                {step.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={step.image}
                    alt={`Étape ${i + 1}`}
                    className="flex-shrink-0 w-20 h-14 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                )}
                <div className="flex-1 min-w-0 pt-0.5">
                  <span className="text-xs font-semibold text-primary">Étape {i + 1}</span>
                  <p className="text-sm leading-relaxed text-foreground line-clamp-2 mt-0.5">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile-only CTA */}
          {steps.length > 0 && (
            <div className="mt-8 md:hidden">
              <Button
                className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg"
                onClick={() => setCookingMode(true)}
              >
                <UtensilsCrossed className="h-5 w-5 mr-2" />
                Cuisiner
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
