"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MealPlanner } from "@/components/recipes/MealPlanner";
import { prepareRecipePhoto } from "@/lib/image";
import { useFeaturesContext } from "@/components/FeaturesContext";
import { useAuth } from "@/lib/useAuth";
import { useGroupContext } from "@/components/GroupContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedNav } from "@/components/ui/segmented-nav";
import { ModuleHero, HeroChip, HeroIconButton } from "@/components/ui/module-hero";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Clock,
  X,
  Check,
  Search,
  Camera,
  CalendarCheck,
  CalendarDays,
  BookOpen,
  Download,
  Loader2,
  LayoutGrid,
  List,
  Grid3X3,
  ArrowUpDown,
  Heart,
} from "lucide-react";
import { useFeedback } from "@/components/ui/feedback";
import { RecipeCard, RecipeRow, RecipeTile, type CardHandlers, type ShoppingListRef } from "@/components/recipes/RecipeCard";
import type { CatalogRecipe, Ingredient } from "@/components/recipes/RecipeEditor";
import { recipeSource, SOURCE_LABELS, totalMinutes, type RecipeSource } from "@/components/recipes/meta";

type ShoppingList = ShoppingListRef;

type Tab = "catalogue" | "prevues" | "semaine";
type ViewMode = "grid" | "list" | "compact";
type SortOption = "recent" | "oldest" | "alpha-asc" | "alpha-desc" | "fastest" | "slowest";

const VIEWS: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: "grid", icon: LayoutGrid, label: "grandes cartes" },
  { mode: "compact", icon: Grid3X3, label: "grille réduite" },
  { mode: "list", icon: List, label: "liste" },
];

const SORTS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Plus récent" },
  { value: "oldest", label: "Plus ancien" },
  { value: "alpha-asc", label: "A → Z" },
  { value: "alpha-desc", label: "Z → A" },
  { value: "fastest", label: "Plus rapide" },
  { value: "slowest", label: "Plus long" },
];

const TIME_FILTERS = [
  { max: 30, label: "30 min max" },
  { max: 60, label: "1 h max" },
];

/** Pastille de filtre : fond carte au repos, encre quand elle est active. */
function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold shadow-surface transition-[background-color,color,transform] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "bg-ink text-ink-foreground" : "bg-card text-foreground/80 hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

const roundBtn =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-surface transition-[background-color,color,transform] duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function RecipesPage() {
  const { confirm, toast } = useFeedback();
  const { isReady } = useAuth();
  const router = useRouter();
  const { currentGroupId } = useGroupContext();
  const [recipes, setRecipes] = useState<CatalogRecipe[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>("catalogue");
  // Vues facultatives (Profil → Fonctionnalités) ; Catalogue reste toujours là.
  const { flags } = useFeaturesContext();
  const showPlanned = flags.recipesPlanned;
  const showWeek = flags.recipesWeek;
  useEffect(() => {
    if ((activeTab === "prevues" && !showPlanned) || (activeTab === "semaine" && !showWeek)) {
      setActiveTab("catalogue");
    }
  }, [activeTab, showPlanned, showWeek]);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Vues liste et compacte : un seul input fichier, hors des éléments cliquables.
  const tileImageInputRef = useRef<HTMLInputElement>(null);
  const tileImageRecipeId = useRef<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<RecipeSource | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const [newRecipe, setNewRecipe] = useState({
    title: "",
    description: "",
    servings: 4,
    prepTime: "",
    cookTime: "",
    steps: [""],
    ingredients: [{ name: "", quantity: "", unit: "" }] as Ingredient[],
  });

  const fetchRecipes = useCallback(() => {
    const url = currentGroupId ? `/api/recipes?groupId=${currentGroupId}` : "/api/recipes";
    // Groupe enregistré devenu invalide (403) : on garde la liste précédente
    // au lieu d'écraser l'état avec l'objet d'erreur, la correction côté
    // GroupContext relance ensuite le chargement avec le bon groupe.
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setRecipes(data);
        setLoadedOnce(true);
      });
  }, [currentGroupId]);

  const fetchLists = useCallback(() => {
    fetch("/api/lists")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setLists(data);
      });
  }, []);

  useEffect(() => {
    if (isReady) fetchRecipes();
  }, [isReady, fetchRecipes]);

  // Les listes ne dépendent pas du groupe : pas de rechargement quand il change.
  useEffect(() => {
    if (isReady) fetchLists();
  }, [isReady, fetchLists]);

  const tabRecipes = recipes.filter((r) =>
    activeTab === "prevues" ? r.planned : r.inCatalog
  );

  const allIngredientNames = Array.from(
    new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.name.toLowerCase())))
  ).sort();

  const suggestions = searchQuery.trim().length >= 2
    ? allIngredientNames
        .filter((name) => name.includes(searchQuery.toLowerCase()) && !filters.includes(name))
        .slice(0, 6)
    : [];

  const addFilter = (name: string) => {
    setFilters((f) => [...f, name.toLowerCase()]);
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const removeFilter = (name: string) => {
    setFilters((f) => f.filter((n) => n !== name));
  };

  const sourceCounts = tabRecipes.reduce<Partial<Record<RecipeSource, number>>>((acc, r) => {
    const s = recipeSource(r.image);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const filteredRecipes = tabRecipes.filter((recipe) => {
    if (favoritesOnly && !recipe.favorite) return false;
    if (sourceFilter && recipeSource(recipe.image) !== sourceFilter) return false;
    if (maxMinutes !== null) {
      const t = totalMinutes(recipe);
      if (t === 0 || t > maxMinutes) return false;
    }
    const matchesFilters = filters.every((f) =>
      recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(f))
    );
    if (!matchesFilters) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      recipe.title.toLowerCase().includes(q) ||
      recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(q))
    );
  });

  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "alpha-asc":
        return a.title.localeCompare(b.title, "fr");
      case "alpha-desc":
        return b.title.localeCompare(a.title, "fr");
      case "fastest": {
        const ta = (a.prepTime || 0) + (a.cookTime || 0);
        const tb = (b.prepTime || 0) + (b.cookTime || 0);
        if (ta === 0 && tb === 0) return 0;
        if (ta === 0) return 1;
        if (tb === 0) return -1;
        return ta - tb;
      }
      case "slowest": {
        const ta = (a.prepTime || 0) + (a.cookTime || 0);
        const tb = (b.prepTime || 0) + (b.cookTime || 0);
        if (ta === 0 && tb === 0) return 0;
        if (ta === 0) return 1;
        if (tb === 0) return -1;
        return tb - ta;
      }
      default:
        return 0;
    }
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addRecipe = async () => {
    if (!newRecipe.title.trim()) return;
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newRecipe.title,
        description: newRecipe.description || null,
        servings: newRecipe.servings,
        prepTime: newRecipe.prepTime ? Number(newRecipe.prepTime) : null,
        cookTime: newRecipe.cookTime ? Number(newRecipe.cookTime) : null,
        steps: newRecipe.steps.filter((s) => s.trim()),
        ingredients: newRecipe.ingredients.filter((i) => i.name.trim()),
        planned: activeTab === "prevues",
        inCatalog: activeTab === "catalogue",
        groupId: currentGroupId,
      }),
    });

    const created = await res.json();

    if (pendingImage && created.id) {
      const formData = new FormData();
      formData.append("image", await prepareRecipePhoto(pendingImage), "photo.jpg");
      const imgRes = await fetch(`/api/recipes/${created.id}/image`, {
        method: "POST",
        body: formData,
      });
      if (!imgRes.ok) {
        const { error } = await imgRes.json().catch(() => ({ error: null }));
        toast(error || "Recette créée, mais impossible d'enregistrer l'image", "error");
      }
    }

    setNewRecipe({
      title: "",
      description: "",
      servings: 4,
      prepTime: "",
      cookTime: "",
      steps: [""],
      ingredients: [{ name: "", quantity: "", unit: "" }],
    });
    setPendingImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setDialogOpen(false);
    fetchRecipes();
  };

  const updateRecipe = async (id: string, data: Record<string, unknown>) => {
    await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchRecipes();
  };

  // Optimiste : le cœur réagit tout de suite, la liste est rechargée ensuite.
  const toggleFavorite = (e: React.MouseEvent, recipe: CatalogRecipe) => {
    e.stopPropagation();
    e.preventDefault();
    const favorite = !recipe.favorite;
    setRecipes((rs) => rs.map((r) => (r.id === recipe.id ? { ...r, favorite } : r)));
    updateRecipe(recipe.id, { favorite });
  };

  const deleteRecipe = async (id: string) => {
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;

    if (activeTab === "prevues") {
      if (recipe.inCatalog) {
        await fetch(`/api/recipes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planned: false }),
        });
      } else {
        const ok = await confirm({
          title: `Supprimer « ${recipe.title} » ?`,
          description: "Elle n'est pas dans le catalogue : cette action est irréversible.",
          confirmLabel: "Supprimer",
          destructive: true,
        });
        if (!ok) return;
        await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      }
    } else {
      const ok = await confirm(
        recipe.planned
          ? {
              title: `Retirer « ${recipe.title} » du catalogue ?`,
              description: "Elle restera dans les recettes prévues.",
              confirmLabel: "Retirer",
            }
          : {
              title: `Supprimer « ${recipe.title} » ?`,
              description: "Cette action est irréversible.",
              confirmLabel: "Supprimer",
              destructive: true,
            }
      );
      if (!ok) return;
      if (recipe.planned) {
        await fetch(`/api/recipes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inCatalog: false }),
        });
      } else {
        await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      }
    }
    fetchRecipes();
  };

  const uploadImage = async (recipeId: string, file: File) => {
    const formData = new FormData();
    formData.append("image", await prepareRecipePhoto(file), "photo.jpg");
    const res = await fetch(`/api/recipes/${recipeId}/image`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      toast(error || "Impossible d'enregistrer l'image", "error");
    }
    fetchRecipes();
  };

  const pickTileImage = (e: React.MouseEvent, recipeId: string) => {
    e.stopPropagation();
    tileImageRecipeId.current = recipeId;
    tileImageInputRef.current?.click();
  };

  const removeImage = async (recipeId: string) => {
    await fetch(`/api/recipes/${recipeId}/image`, { method: "DELETE" });
    fetchRecipes();
  };

  const addToShoppingList = async (recipeId: string, listId?: string) => {
    await fetch(`/api/recipes/${recipeId}/to-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: listId || null }),
    });
    fetchLists();
    fetchRecipes();
  };

  const addIngredientField = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [...newRecipe.ingredients, { name: "", quantity: "", unit: "" }],
    });
  };

  const removeIngredientField = (index: number) => {
    setNewRecipe({
      ...newRecipe,
      ingredients: newRecipe.ingredients.filter((_, i) => i !== index),
    });
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...newRecipe.ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setNewRecipe({ ...newRecipe, ingredients: updated });
  };

  const addStepField = () => {
    setNewRecipe({ ...newRecipe, steps: [...newRecipe.steps, ""] });
  };

  const updateStep = (index: number, value: string) => {
    const updated = [...newRecipe.steps];
    updated[index] = value;
    setNewRecipe({ ...newRecipe, steps: updated });
  };

  const removeStepField = (index: number) => {
    setNewRecipe({
      ...newRecipe,
      steps: newRecipe.steps.filter((_, i) => i !== index),
    });
  };

  const importFromUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError("");
    try {
      const targetUrl = importUrl.trim();
      // Aiguillage sur l'hôte (ancré), pas sur une recherche dans toute l'URL.
      let host = "";
      let path = "";
      try {
        const parsed = new URL(targetUrl);
        host = parsed.hostname.toLowerCase();
        path = parsed.pathname;
      } catch {
        /* URL invalide : ni Jow ni HelloFresh, l'erreur ci-dessous s'applique */
      }
      const isJow = /^(?:www\.)?jow\.fr$/.test(host) && /^\/(?:en\/)?recipes\//.test(path);
      const isHelloFresh = /^(?:www\.)?hellofresh\.(?:[a-z]{2,3}|co\.uk|com\.au)$/.test(host);

      if (isJow) {
        const res = await fetch("/api/recipes/import-jow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl, servings: 4, groupId: currentGroupId, planned: activeTab === "prevues", inCatalog: activeTab === "catalogue" }),
        });
        const data = await res.json().catch(() => ({ error: "Réponse invalide" }));
        if (!res.ok) throw new Error(data.error || "Erreur inconnue");
        setImportUrl("");
        setImportOpen(false);
        fetchRecipes();
        router.push(`/recipes/${data.id}`);
        return;
      }

      if (!isHelloFresh) throw new Error("URL non reconnue — colle un lien Jow ou HelloFresh");

      const hfUrl = targetUrl.split("?")[0];
      const idMatch = hfUrl.match(/([0-9a-f]{20,})(?:\?|$)/);
      if (!idMatch) throw new Error("URL HelloFresh invalide — ID de recette introuvable");
      const recipeHFId = idMatch[1];

      const tokenRes = await fetch("/api/hellofresh-token");
      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error("Token HelloFresh non configure sur le serveur");

      const apiRes = await fetch(
        `https://gw.hellofresh.com/api/recipes/${recipeHFId}?country=FR&locale=fr-FR`,
        { headers: { Authorization: `Bearer ${tokenData.token}`, Accept: "application/json" } }
      );
      if (!apiRes.ok) throw new Error(`HelloFresh API: ${apiRes.status}`);
      const recipe = await apiRes.json();

      const stripHtml = (t: string) => t.replace(/<[^>]*>/g, "").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
      const heroImage = recipe.imagePath
        ? `https://img.hellofresh.com/q_auto,f_auto,w_1200/hellofresh_s3${recipe.imagePath}`
        : recipe.imageLink || null;
      const steps = (recipe.steps || [])
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((s: { instructionsMarkdown?: string; instructions?: string; images?: { path?: string; link?: string }[] }) => ({
          text: stripHtml(s.instructionsMarkdown || s.instructions || ""),
          image: s.images?.[0]?.path
            ? `https://img.hellofresh.com/q_auto,f_auto,w_750/hellofresh_s3${s.images[0].path}`
            : s.images?.[0]?.link || null,
        }))
        .filter((s: { text: string; image: string | null }) => s.text || s.image);

      const servings = 4;
      const yieldForServings = recipe.yields?.find((y: { yields: number }) => y.yields === servings) || recipe.yields?.[0];
      const ingredients = (recipe.ingredients || []).map((ing: { id?: string; name?: string }) => {
        const yieldIng = yieldForServings?.ingredients?.find((yi: { id?: string }) => yi.id === ing.id);
        return {
          name: ing.name || "",
          quantity: yieldIng?.amount != null ? String(yieldIng.amount) : "",
          unit: yieldIng?.unit || "",
        };
      }).filter((i: { name: string }) => i.name);

      let totalTime: number | null = null;
      const timeStr = recipe.prepTime || recipe.totalTime;
      if (timeStr) {
        const tm = timeStr.match(/PT(\d+)M/);
        if (tm) totalTime = parseInt(tm[1]);
      }

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recipe.name || "Recette HelloFresh",
          description: stripHtml(recipe.headline || recipe.description || ""),
          servings,
          prepTime: totalTime ? Math.round(totalTime * 0.4) : null,
          cookTime: totalTime ? Math.round(totalTime * 0.6) : null,
          steps,
          image: heroImage,
          planned: activeTab === "prevues",
          inCatalog: activeTab === "catalogue",
          groupId: currentGroupId,
          ingredients,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Reponse invalide" }));
      if (!res.ok) throw new Error(data.error || "Erreur inconnue");
      setImportUrl("");
      setImportOpen(false);
      fetchRecipes();
      router.push(`/recipes/${data.id}`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setImporting(false);
    }
  };


  const plannedCount = recipes.filter((r) => r.planned).length;
  const catalogCount = recipes.filter((r) => r.inCatalog).length;
  const favoriteCount = recipes.filter((r) => r.inCatalog && r.favorite).length;
  const anyFilter = favoritesOnly || maxMinutes !== null || sourceFilter !== null || filters.length > 0 || searchQuery.trim() !== "";
  const onlyFavorites = favoritesOnly && !searchQuery && !sourceFilter && maxMinutes === null && filters.length === 0;
  const clearAll = () => {
    setFavoritesOnly(false);
    setMaxMinutes(null);
    setSourceFilter(null);
    setFilters([]);
    setSearchQuery("");
  };

  const handlers: CardHandlers = {
    lists,
    tab: activeTab === "prevues" ? "prevues" : "catalogue",
    onToggleFavorite: toggleFavorite,
    onUpdate: updateRecipe,
    onDelete: deleteRecipe,
    onAddToList: addToShoppingList,
    onUploadImage: uploadImage,
    onRemoveImage: removeImage,
    onEnriched: fetchRecipes,
    onPickImage: pickTileImage,
  };

  if (!isReady) return null;

  const view = VIEWS.find((v) => v.mode === viewMode)!;
  const nextView = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];

  const browse = (
    <div className="space-y-4">
      {/* Recherche, tri, affichage */}
      <div className="flex items-start gap-2">
        <div className="relative min-w-0 flex-1" ref={searchRef}>
          <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-[1.5rem] bg-card px-4 py-1 shadow-surface focus-within:ring-2 focus-within:ring-ring">
            {filters.map((f) => (
              <span key={f} className="inline-flex h-8 items-center gap-1 rounded-full bg-tone-meal-soft pl-3 pr-1 text-sm font-bold text-tone-meal-ink">
                {f}
                <button
                  type="button"
                  aria-label={`Retirer le filtre ${f}`}
                  onClick={() => removeFilter(f)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            <div className="relative min-w-[7rem] flex-1">
              <Search className={`pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${filters.length > 0 ? "hidden" : ""}`} />
              <input
                placeholder={filters.length > 0 ? "Autre ingrédient…" : "Titre ou ingrédient…"}
                aria-label="Rechercher une recette par titre ou ingrédient"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !searchQuery && filters.length > 0) {
                    removeFilter(filters[filters.length - 1]);
                  }
                  if (e.key === "Enter" && suggestions.length > 0) {
                    e.preventDefault();
                    addFilter(suggestions[0]);
                  }
                }}
                className={`h-10 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground ${filters.length > 0 ? "pl-1" : "pl-6"}`}
              />
            </div>
            {(searchQuery || filters.length > 0) && (
              <button
                type="button"
                aria-label="Effacer la recherche"
                onClick={() => { setSearchQuery(""); setFilters([]); }}
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl bg-popover py-1 shadow-surface">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addFilter(name)}
                  className="flex min-h-11 w-full items-center px-4 text-left text-base transition-colors hover:bg-secondary"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative" ref={sortRef}>
          <button
            type="button"
            onClick={() => setSortOpen(!sortOpen)}
            aria-label="Trier"
            aria-expanded={sortOpen}
            title="Trier"
            className={cn(roundBtn, sortBy !== "recent" ? "bg-ink text-ink-foreground" : "bg-card text-foreground/70 hover:text-foreground")}
          >
            <ArrowUpDown className="h-5 w-5" />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-2xl bg-popover py-1 shadow-surface">
              {SORTS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setSortBy(value); setSortOpen(false); }}
                  aria-pressed={sortBy === value}
                  className={cn(
                    "flex min-h-11 w-full items-center px-4 text-left text-base transition-colors",
                    sortBy === value ? "bg-tone-meal-soft font-bold text-tone-meal-ink" : "hover:bg-secondary"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setViewMode(nextView.mode)}
          aria-label={`Affichage : ${view.label}. Passer en ${nextView.label}`}
          title={`Affichage : ${view.label}`}
          className={cn(roundBtn, "bg-card text-foreground/70 hover:text-foreground")}
        >
          <view.icon className="h-5 w-5" />
        </button>
      </div>

      {/* Filtres */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        <FilterChip on={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
          <Heart className={cn("h-4 w-4", favoritesOnly && "fill-current")} />
          Favoris
        </FilterChip>
        {TIME_FILTERS.map((t) => (
          <FilterChip key={t.max} on={maxMinutes === t.max} onClick={() => setMaxMinutes(maxMinutes === t.max ? null : t.max)}>
            <Clock className="h-4 w-4" />
            {t.label}
          </FilterChip>
        ))}
        {(Object.keys(SOURCE_LABELS) as RecipeSource[])
          .filter((s) => sourceCounts[s])
          .map((s) => (
            <FilterChip key={s} on={sourceFilter === s} onClick={() => setSourceFilter(sourceFilter === s ? null : s)}>
              {SOURCE_LABELS[s]}
              <span className="tabular-nums opacity-60">{sourceCounts[s]}</span>
            </FilterChip>
          ))}
        {anyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Tout effacer
          </button>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {sortedRecipes.length} recette{sortedRecipes.length > 1 ? "s" : ""}
      </p>

      {/* États vides */}
      {loadedOnce && sortedRecipes.length === 0 && !anyFilter && activeTab === "prevues" && (
        <EmptyState icon={CalendarCheck} tone="meal" title="Rien de prévu pour l'instant">
          Planifie une recette depuis le catalogue avec l&apos;icône calendrier.
        </EmptyState>
      )}
      {loadedOnce && sortedRecipes.length === 0 && !anyFilter && activeTab === "catalogue" && (
        <EmptyState
          icon={BookOpen}
          tone="meal"
          title="Ton catalogue est vide"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button className="h-12 rounded-full px-5 text-base font-bold" onClick={() => setImportOpen(true)}>
                <Download className="mr-2 h-4 w-4" />
                Importer une recette
              </Button>
              <Button variant="outline" className="h-12 rounded-full px-5 text-base font-bold" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                La saisir moi-même
              </Button>
            </div>
          }
        >
          Colle le lien d&apos;une recette Jow ou HelloFresh : ingrédients, étapes et photo arrivent tout seuls.
        </EmptyState>
      )}
      {loadedOnce && sortedRecipes.length === 0 && anyFilter && (
        <EmptyState
          icon={onlyFavorites ? Heart : Search}
          tone="meal"
          title={onlyFavorites ? "Aucun favori ici" : "Aucune recette ne correspond"}
          action={
            <Button variant="outline" className="h-12 rounded-full px-5 text-base font-bold" onClick={clearAll}>
              Tout effacer
            </Button>
          }
        >
          {onlyFavorites ? "Touche le cœur d'une recette pour la retrouver ici." : "Essaie moins de filtres, ou un autre ingrédient."}
        </EmptyState>
      )}

      {/* Cartes */}
      {sortedRecipes.length > 0 && viewMode === "grid" && (
        <ul className="grid gap-x-5 gap-y-8 pt-1 sm:grid-cols-2 lg:grid-cols-3">
          {sortedRecipes.map((recipe, i) => (
            <li key={recipe.id} className="min-w-0">
              <RecipeCard recipe={recipe} h={handlers} priority={i < 2} />
            </li>
          ))}
        </ul>
      )}
      {sortedRecipes.length > 0 && viewMode === "list" && (
        <ul className="space-y-2.5 pt-1">
          {sortedRecipes.map((recipe) => (
            <RecipeRow key={recipe.id} recipe={recipe} h={handlers} />
          ))}
        </ul>
      )}
      {sortedRecipes.length > 0 && viewMode === "compact" && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5 pt-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sortedRecipes.map((recipe) => (
            <RecipeTile key={recipe.id} recipe={recipe} h={handlers} />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <ModuleHero
        tone="meal"
        title="Recettes"
        count={loadedOnce ? catalogCount : null}
        countLabel={catalogCount > 1 ? "recettes au catalogue" : "recette au catalogue"}
        action={
          <>
            <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportUrl(""); setImportError(""); } }}>
              <DialogTrigger asChild>
                <HeroIconButton aria-label="Importer une recette" title="Importer une recette">
                  <Download className="h-5 w-5" />
                </HeroIconButton>
              </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importer une recette</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Colle le lien d&apos;une recette Jow ou HelloFresh pour importer automatiquement les ingrédients, étapes et photos.
              </p>
              <Input
                placeholder="https://jow.fr/recipes/... ou https://hellofresh.fr/recipes/..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !importing) importFromUrl(); }}
                disabled={importing}
              />
              {importError && (
                <p className="text-sm text-destructive">{importError}</p>
              )}
              <Button className="w-full" onClick={importFromUrl} disabled={importing || !importUrl.trim()}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Importer la recette
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <HeroIconButton aria-label="Nouvelle recette" title="Nouvelle recette" className="bg-on-tone text-tone-meal hover:bg-on-tone/90">
                  <Plus className="h-6 w-6" strokeWidth={3} />
                </HeroIconButton>
              </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter une recette</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Photo */}
              <div>
                <Label>Photo (optionnel)</Label>
                <div className="mt-1">
                  {pendingImage ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={URL.createObjectURL(pendingImage)}
                        alt="Aperçu"
                        className="w-full h-44 object-cover rounded-xl"
                      />
                      <button aria-label="Retirer la photo"
                        onClick={() => {
                          setPendingImage(null);
                          if (imageInputRef.current) imageInputRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Camera className="h-5 w-5" />
                      <span className="text-xs font-medium">Ajouter une photo</span>
                    </button>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPendingImage(file);
                    }}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="recipes-titre">Titre</Label>
                <Input id="recipes-titre"
                  value={newRecipe.title}
                  onChange={(e) => setNewRecipe({ ...newRecipe, title: e.target.value })}
                  placeholder="Ex: Poulet rôti, Tarte aux pommes..."
                />
              </div>
              <div>
                <Label htmlFor="recipes-description-optionnel">Description (optionnel)</Label>
                <Textarea id="recipes-description-optionnel"
                  value={newRecipe.description}
                  onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="recipes-portions">Portions</Label>
                  <Input id="recipes-portions" type="number" value={newRecipe.servings} onChange={(e) => setNewRecipe({ ...newRecipe, servings: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="recipes-prep-min">Prep (min)</Label>
                  <Input id="recipes-prep-min" type="number" value={newRecipe.prepTime} onChange={(e) => setNewRecipe({ ...newRecipe, prepTime: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="recipes-cuisson-min">Cuisson (min)</Label>
                  <Input id="recipes-cuisson-min" type="number" value={newRecipe.cookTime} onChange={(e) => setNewRecipe({ ...newRecipe, cookTime: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Ingrédients</Label>
                <div className="space-y-2 mt-1">
                  {newRecipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="Nom" aria-label={`Ingrédient ${i + 1}`} value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} className="flex-1" />
                      <Input placeholder="Qté" aria-label={`Quantité de l’ingrédient ${i + 1}`} value={ing.quantity} onChange={(e) => updateIngredient(i, "quantity", e.target.value)} className="w-20" />
                      <Input placeholder="Unité" aria-label={`Unité de l’ingrédient ${i + 1}`} value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)} className="w-20" />
                      {newRecipe.ingredients.length > 1 && (
                        <Button aria-label="Retirer l'ingrédient" variant="ghost" size="icon" onClick={() => removeIngredientField(i)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addIngredientField}>
                    <Plus className="h-3 w-3 mr-1" />Ingrédient
                  </Button>
                </div>
              </div>
              <div>
                <Label>Étapes</Label>
                <div className="space-y-2 mt-1">
                  {newRecipe.steps.map((step, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-sm text-muted-foreground mt-2 w-6 shrink-0">{i + 1}.</span>
                      <Textarea placeholder={`Étape ${i + 1}`} aria-label={`Étape ${i + 1}`} value={step} onChange={(e) => updateStep(i, e.target.value)} className="flex-1" rows={2} />
                      {newRecipe.steps.length > 1 && (
                        <Button aria-label="Retirer l'étape" variant="ghost" size="icon" onClick={() => removeStepField(i)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addStepField}>
                    <Plus className="h-3 w-3 mr-1" />Étape
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={addRecipe}>Enregistrer la recette</Button>
            </div>
          </DialogContent>
            </Dialog>
          </>
        }
      >
        {favoriteCount > 0 && (
          <HeroChip>
            <Heart className="h-3.5 w-3.5 fill-current" />
            {favoriteCount} favori{favoriteCount > 1 ? "s" : ""}
          </HeroChip>
        )}
        {plannedCount > 0 && showPlanned && (
          <HeroChip>
            <CalendarCheck className="h-3.5 w-3.5" />
            {plannedCount} prévue{plannedCount > 1 ? "s" : ""}
          </HeroChip>
        )}
      </ModuleHero>

      {(showPlanned || showWeek) && (
        <SegmentedNav
          label="Vues des recettes"
          idPrefix="recipes-tab"
          tone="meal"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            ...(showPlanned ? [{ value: "prevues" as Tab, label: "Prévues", icon: <CalendarCheck className="h-4 w-4" />, count: plannedCount }] : []),
            { value: "catalogue" as Tab, label: "Catalogue", icon: <BookOpen className="h-4 w-4" />, count: catalogCount },
            ...(showWeek ? [{ value: "semaine" as Tab, label: "Semaine", icon: <CalendarDays className="h-4 w-4" /> }] : []),
          ]}
        />
      )}
      <div id="recipes-tab-panel" role={showPlanned || showWeek ? "tabpanel" : undefined} aria-labelledby={`recipes-tab-${activeTab}`}>
        {activeTab === "semaine" ? (
          <MealPlanner
            recipes={recipes}
            groupId={currentGroupId}
            onOpenRecipe={(id) => router.push(`/recipes/${id}`)}
            onPlannedChange={fetchRecipes}
          />
        ) : (
          browse
        )}
      </div>

      <input
        ref={tileImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && tileImageRecipeId.current) uploadImage(tileImageRecipeId.current, f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
