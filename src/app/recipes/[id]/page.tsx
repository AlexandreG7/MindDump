"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isReady } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
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
  const isOverview = currentStep === -1;
  const isLastStep = currentStep === steps.length - 1;

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const goPrev = () => {
    if (currentStep >= 0) setCurrentStep(currentStep - 1);
  };

  const multiplyQuantity = (qty: string): string => {
    if (servingMultiplier === 1) return qty;
    const num = parseFloat(qty.replace(",", "."));
    if (isNaN(num)) return qty;
    const result = num * servingMultiplier;
    return result % 1 === 0 ? String(result) : result.toFixed(1).replace(".", ",");
  };

  // ── Step-by-step mode ──
  if (!isOverview) {
    return (
      <div className="recipe-step-page">
        <div className="recipe-step-header">
          <button
            onClick={() => setCurrentStep(-1)}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-sm font-medium text-muted-foreground">
              {recipe.title}
            </span>
          </div>
          <div className="w-9" />
        </div>

        <div className="px-6 pt-4 pb-2 max-w-3xl mx-auto w-full">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i <= currentStep ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 pb-8 overflow-y-auto">
          {steps[currentStep].image && (
            <div className="max-w-lg mx-auto w-full mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={steps[currentStep].image!}
                alt={`Étape ${currentStep + 1}`}
                className="w-full rounded-2xl object-cover"
              />
            </div>
          )}

          <div className="text-center mb-4">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white text-xl font-bold mb-2">
              {currentStep + 1}
            </span>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Étape {currentStep + 1} sur {steps.length}
            </p>
          </div>

          <p className="text-lg leading-relaxed text-center max-w-2xl mx-auto">
            {steps[currentStep].text}
          </p>
        </div>

        <div className="recipe-step-nav">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14 rounded-2xl text-base"
            onClick={goPrev}
            disabled={currentStep <= 0}
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Précédent
          </Button>

          {isLastStep ? (
            <Button
              size="lg"
              className="flex-1 h-14 rounded-2xl text-base bg-green-600 hover:bg-green-700"
              onClick={() => setCurrentStep(-1)}
            >
              <Check className="h-5 w-5 mr-1" />
              Terminé
            </Button>
          ) : (
            <Button
              size="lg"
              className="flex-1 h-14 rounded-2xl text-base"
              onClick={goNext}
            >
              Suivant
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
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
                onClick={() => setCurrentStep(0)}
              >
                <UtensilsCrossed className="h-4 w-4 mr-1.5" />
                Commencer
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className="w-full flex gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left group"
              >
                {step.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={step.image}
                    alt={`Étape ${i + 1}`}
                    className="flex-shrink-0 w-20 h-14 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    {i + 1}
                  </span>
                )}
                <div className="flex-1 min-w-0 pt-0.5">
                  <span className="text-xs font-semibold text-primary">Étape {i + 1}</span>
                  <p className="text-sm leading-relaxed text-foreground line-clamp-2 mt-0.5">
                    {step.text}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Mobile-only CTA */}
          {steps.length > 0 && (
            <div className="mt-8 md:hidden">
              <Button
                className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg"
                onClick={() => setCurrentStep(0)}
              >
                <UtensilsCrossed className="h-5 w-5 mr-2" />
                Commencer la recette
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
