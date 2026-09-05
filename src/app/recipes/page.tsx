"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useGroupContext } from "@/components/GroupContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Clock,
  ShoppingCart,
  X,
  Pencil,
  Check,
  Search,
  Camera,
  CalendarCheck,
  BookOpen,
  BookMarked,
  Users,
  UtensilsCrossed,
  Download,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface Ingredient {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
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
  ingredients: Ingredient[];
}

interface ShoppingList {
  id: string;
  name: string;
  type?: string;
}

type Tab = "catalogue" | "prevues";

export default function RecipesPage() {
  const { isReady } = useAuth();
  const router = useRouter();
  const { currentGroupId } = useGroupContext();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("catalogue");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
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
    fetch(url).then((r) => r.json()).then(setRecipes);
  }, [currentGroupId]);

  const fetchLists = useCallback(() => {
    fetch("/api/lists").then((r) => r.json()).then(setLists);
  }, []);

  useEffect(() => {
    if (isReady) {
      fetchRecipes();
      fetchLists();
    }
  }, [isReady, fetchRecipes, fetchLists]);

  const tabRecipes = recipes.filter((r) =>
    activeTab === "prevues" ? r.planned : true
  );

  const filteredRecipes = tabRecipes.filter((recipe) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      recipe.title.toLowerCase().includes(q) ||
      recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(q))
    );
  });

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
        groupId: currentGroupId,
      }),
    });

    const created = await res.json();

    if (pendingImage && created.id) {
      const formData = new FormData();
      formData.append("image", pendingImage);
      await fetch(`/api/recipes/${created.id}/image`, {
        method: "POST",
        body: formData,
      });
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

  const deleteRecipe = async (id: string) => {
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    fetchRecipes();
  };

  const uploadImage = async (recipeId: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    await fetch(`/api/recipes/${recipeId}/image`, {
      method: "POST",
      body: formData,
    });
    fetchRecipes();
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

  const importFromHelloFresh = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError("");
    try {
      const targetUrl = importUrl.trim().split("?")[0];
      const idMatch = targetUrl.match(/([0-9a-f]{20,})(?:\?|$)/);
      if (!idMatch) throw new Error("URL HelloFresh invalide — ID de recette introuvable");
      const recipeHFId = idMatch[1];

      // Get token from our server (server can't reach HF, but it stores the token)
      const tokenRes = await fetch("/api/hellofresh-token");
      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error("Token HelloFresh non configure sur le serveur");

      // Call HF API directly from browser (CORS allowed on gw.hellofresh.com)
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
          planned: false,
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

  if (!isReady) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Recettes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {recipes.length} recette{recipes.length !== 1 ? "s" : ""} au catalogue
          </p>
        </div>
        <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportUrl(""); setImportError(""); } }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="shrink-0">
              <Download className="h-4 w-4 mr-2" />
              HelloFresh
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importer depuis HelloFresh</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Colle le lien d&apos;une recette HelloFresh pour importer automatiquement les ingredients, etapes et photos.
              </p>
              <Input
                placeholder="https://www.hellofresh.fr/recipes/..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !importing) importFromHelloFresh(); }}
                disabled={importing}
              />
              {importError && (
                <p className="text-sm text-destructive">{importError}</p>
              )}
              <Button className="w-full" onClick={importFromHelloFresh} disabled={importing || !importUrl.trim()}>
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
            <Button className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle recette
            </Button>
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
                      <button
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
                <Label>Titre</Label>
                <Input
                  value={newRecipe.title}
                  onChange={(e) => setNewRecipe({ ...newRecipe, title: e.target.value })}
                  placeholder="Ex: Poulet roti, Tarte aux pommes..."
                />
              </div>
              <div>
                <Label>Description (optionnel)</Label>
                <Textarea
                  value={newRecipe.description}
                  onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Portions</Label>
                  <Input type="number" value={newRecipe.servings} onChange={(e) => setNewRecipe({ ...newRecipe, servings: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Prep (min)</Label>
                  <Input type="number" value={newRecipe.prepTime} onChange={(e) => setNewRecipe({ ...newRecipe, prepTime: e.target.value })} />
                </div>
                <div>
                  <Label>Cuisson (min)</Label>
                  <Input type="number" value={newRecipe.cookTime} onChange={(e) => setNewRecipe({ ...newRecipe, cookTime: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Ingredients</Label>
                <div className="space-y-2 mt-1">
                  {newRecipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="Nom" value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} className="flex-1" />
                      <Input placeholder="Qte" value={ing.quantity} onChange={(e) => updateIngredient(i, "quantity", e.target.value)} className="w-20" />
                      <Input placeholder="Unite" value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)} className="w-20" />
                      {newRecipe.ingredients.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeIngredientField(i)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addIngredientField}>
                    <Plus className="h-3 w-3 mr-1" />Ingredient
                  </Button>
                </div>
              </div>
              <div>
                <Label>Etapes</Label>
                <div className="space-y-2 mt-1">
                  {newRecipe.steps.map((step, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-sm text-muted-foreground mt-2 w-6 shrink-0">{i + 1}.</span>
                      <Textarea placeholder={`Etape ${i + 1}`} value={step} onChange={(e) => updateStep(i, e.target.value)} className="flex-1" rows={2} />
                      {newRecipe.steps.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeStepField(i)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addStepField}>
                    <Plus className="h-3 w-3 mr-1" />Etape
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={addRecipe}>Enregistrer la recette</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-secondary rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("prevues")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "prevues"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          Prévues
          {plannedCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              activeTab === "prevues" ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary"
            }`}>
              {plannedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("catalogue")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "catalogue"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Catalogue
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
            activeTab === "catalogue" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {recipes.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Titre ou ingrédient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Empty states */}
      {activeTab === "prevues" && filteredRecipes.length === 0 && !searchQuery && (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <CalendarCheck className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Aucune recette prévue</p>
            <p className="text-sm text-muted-foreground mt-1">
              Planifie une recette depuis le catalogue en cliquant sur &quot;Planifier&quot;
            </p>
          </div>
        </div>
      )}

      {activeTab === "catalogue" && filteredRecipes.length === 0 && !searchQuery && (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <BookOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Catalogue vide</p>
            <p className="text-sm text-muted-foreground mt-1">Commence par ajouter ta première recette</p>
          </div>
        </div>
      )}

      {searchQuery && filteredRecipes.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          Aucun résultat pour &quot;{searchQuery}&quot;
        </p>
      )}

      {/* Recipe grid */}
      {filteredRecipes.length > 0 && (
        <div className="masonry-grid">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              lists={lists}
              activeTab={activeTab}
              isExpanded={false}
              onToggleExpand={() => {}}
              onUpdate={updateRecipe}
              onDelete={deleteRecipe}
              onAddToList={addToShoppingList}
              onUploadImage={uploadImage}
              onRemoveImage={removeImage}
              onSaveToCatalogue={() => setActiveTab("catalogue")}
              onOpenDetail={() => router.push(`/recipes/${recipe.id}`)}
              onEnriched={fetchRecipes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Recipe Card ─────────────────────────────────────────── */

function RecipeCard({
  recipe,
  lists,
  activeTab,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onAddToList,
  onUploadImage,
  onRemoveImage,
  onSaveToCatalogue,
  onOpenDetail,
  onEnriched,
}: {
  recipe: Recipe;
  lists: ShoppingList[];
  activeTab: Tab;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onAddToList: (recipeId: string, listId?: string) => void;
  onUploadImage: (recipeId: string, file: File) => void;
  onRemoveImage: (recipeId: string) => void;
  onSaveToCatalogue: () => void;
  onOpenDetail: () => void;
  onEnriched: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(recipe.title);
  const [editServings, setEditServings] = useState(String(recipe.servings));
  const [editPrepTime, setEditPrepTime] = useState(String(recipe.prepTime || ""));
  const [editCookTime, setEditCookTime] = useState(String(recipe.cookTime || ""));
  const [editDescription, setEditDescription] = useState(recipe.description || "");
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>(
    recipe.ingredients.map((i) => ({ ...i }))
  );
  const [editSteps, setEditSteps] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(recipe.steps);
      return parsed.map((s: string | { text: string }) => typeof s === "string" ? s : s.text);
    } catch { return []; }
  });
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [newIng, setNewIng] = useState({ name: "", quantity: "", unit: "" });
  const [pendingEditImage, setPendingEditImage] = useState<File | null>(null);
  const editImageRef = useRef<HTMLInputElement>(null);
  const cardImageRef = useRef<HTMLInputElement>(null);
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState("");
  const [enrichResult, setEnrichResult] = useState<{
    image?: boolean;
    description?: boolean;
    steps?: boolean;
    stepsCount?: number;
    stepImages?: number;
    ingredients?: number;
    prepTime?: boolean;
    cookTime?: boolean;
  } | null>(null);

  const steps: string[] = (() => {
    try {
      const parsed = JSON.parse(recipe.steps);
      return parsed.map((s: string | { text: string }) => typeof s === "string" ? s : s.text);
    } catch { return []; }
  })();

  const startEditing = () => {
    setEditTitle(recipe.title);
    setEditServings(String(recipe.servings));
    setEditPrepTime(String(recipe.prepTime || ""));
    setEditCookTime(String(recipe.cookTime || ""));
    setEditDescription(recipe.description || "");
    setEditIngredients(recipe.ingredients.map((i) => ({ ...i })));
    try {
      const parsed = JSON.parse(recipe.steps);
      setEditSteps(parsed.map((s: string | { text: string }) => typeof s === "string" ? s : s.text));
    } catch { setEditSteps([]); }
    setPendingEditImage(null);
    setEditing(true);
  };

  const saveEdits = () => {
    onUpdate(recipe.id, {
      title: editTitle,
      servings: Number(editServings) || 4,
      prepTime: editPrepTime ? Number(editPrepTime) : null,
      cookTime: editCookTime ? Number(editCookTime) : null,
      description: editDescription || null,
      ingredients: editIngredients.filter((i) => i.name.trim()).map((i) => ({
        name: i.name,
        quantity: i.quantity || "1",
        unit: i.unit || null,
      })),
      steps: editSteps.filter((s) => s.trim()),
    });
    if (pendingEditImage) {
      onUploadImage(recipe.id, pendingEditImage);
    }
    setEditing(false);
  };

  const cancelEdits = () => {
    setEditing(false);
    setAddingIngredient(false);
    setPendingEditImage(null);
  };

  const quickAddIngredient = () => {
    if (!newIng.name.trim()) return;
    onUpdate(recipe.id, {
      addIngredients: [{ name: newIng.name, quantity: newIng.quantity || "1", unit: newIng.unit || null }],
    });
    setNewIng({ name: "", quantity: "", unit: "" });
    setAddingIngredient(false);
  };

  const togglePlanned = () => {
    onUpdate(recipe.id, { planned: !recipe.planned });
  };

  const enrichFromHelloFresh = async () => {
    if (!enrichUrl.trim()) return;
    setEnriching(true);
    setEnrichError("");
    setEnrichResult(null);
    try {
      const targetUrl = enrichUrl.trim().split("?")[0];
      const idMatch = targetUrl.match(/([0-9a-f]{20,})(?:\?|$)/);
      if (!idMatch) throw new Error("URL HelloFresh invalide");
      const recipeHFId = idMatch[1];

      const tokenRes = await fetch("/api/hellofresh-token");
      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error("Token HelloFresh non configure");

      const apiRes = await fetch(
        `https://gw.hellofresh.com/api/recipes/${recipeHFId}?country=FR&locale=fr-FR`,
        { headers: { Authorization: `Bearer ${tokenData.token}`, Accept: "application/json" } }
      );
      if (!apiRes.ok) throw new Error(`HelloFresh API: ${apiRes.status}`);
      const hfData = await apiRes.json();

      const stripHtml = (t: string) => t.replace(/<[^>]*>/g, "").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
      const heroImage = hfData.imagePath
        ? `https://img.hellofresh.com/q_auto,f_auto,w_1200/hellofresh_s3${hfData.imagePath}`
        : hfData.imageLink || null;
      const steps = (hfData.steps || [])
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((s: { instructionsMarkdown?: string; instructions?: string; images?: { path?: string; link?: string }[] }) => ({
          text: stripHtml(s.instructionsMarkdown || s.instructions || ""),
          image: s.images?.[0]?.path
            ? `https://img.hellofresh.com/q_auto,f_auto,w_750/hellofresh_s3${s.images[0].path}`
            : s.images?.[0]?.link || null,
        }))
        .filter((s: { text: string; image: string | null }) => s.text || s.image);

      const yieldForServings = hfData.yields?.find((y: { yields: number }) => y.yields === recipe.servings) || hfData.yields?.[0];
      const ingredients = (hfData.ingredients || []).map((ing: { id?: string; name?: string }) => {
        const yieldIng = yieldForServings?.ingredients?.find((yi: { id?: string }) => yi.id === ing.id);
        return { name: ing.name || "", quantity: yieldIng?.amount != null ? String(yieldIng.amount) : "", unit: yieldIng?.unit || "" };
      }).filter((i: { name: string }) => i.name);

      let totalTime: number | null = null;
      const timeStr = hfData.prepTime || hfData.totalTime;
      if (timeStr) { const tm = timeStr.match(/PT(\d+)M/); if (tm) totalTime = parseInt(tm[1]); }

      // Build update payload — only fill missing fields
      const updates: Record<string, unknown> = {};
      if ((!recipe.image) && heroImage) updates.image = heroImage;
      if (!recipe.description && (hfData.headline || hfData.description))
        updates.description = stripHtml(hfData.headline || hfData.description || "");
      if (!recipe.prepTime && totalTime) updates.prepTime = Math.round(totalTime * 0.4);
      if (!recipe.cookTime && totalTime) updates.cookTime = Math.round(totalTime * 0.6);

      let currentSteps: { text: string; image?: string | null }[] = [];
      try { currentSteps = JSON.parse(recipe.steps); } catch { currentSteps = []; }
      const hasStepImages = currentSteps.some((s) => typeof s === "object" && s.image);
      if (steps.length > 0 && (currentSteps.length === 0 || !hasStepImages)) {
        updates.steps = steps;
      }
      if (recipe.ingredients.length === 0 && ingredients.length > 0) {
        updates.ingredients = ingredients;
      }

      if (Object.keys(updates).length > 0) {
        const patchRes = await fetch(`/api/recipes/${recipe.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!patchRes.ok) throw new Error("Erreur lors de la mise a jour");
      }

      setEnrichResult({
        image: !!updates.image,
        description: !!updates.description,
        steps: !!updates.steps,
        stepsCount: steps.length,
        stepImages: steps.filter((s: { image: string | null }) => s.image).length,
        ingredients: updates.ingredients ? ingredients.length : 0,
        prepTime: !!updates.prepTime,
        cookTime: !!updates.cookTime,
      });
      onEnriched();
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setEnriching(false);
    }
  };

  if (editing) {
    return (
      <div className="recipe-card">
        {/* Edit image */}
        <div>
          {pendingEditImage ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(pendingEditImage)} alt="Aperçu" className="w-full h-44 object-cover" />
              <button
                onClick={() => { setPendingEditImage(null); if (editImageRef.current) editImageRef.current.value = ""; }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : recipe.image ? (
            <div className="relative group/img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={recipe.image} alt={recipe.title} className="w-full h-44 object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover/img:opacity-100">
                <button
                  onClick={() => editImageRef.current?.click()}
                  className="p-2 bg-white/90 rounded-full text-foreground hover:bg-white"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onRemoveImage(recipe.id)}
                  className="p-2 bg-white/90 rounded-full text-destructive hover:bg-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => editImageRef.current?.click()}
              className="w-full h-16 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors border-b border-border"
            >
              <Camera className="h-4 w-4" />
              <span className="text-xs font-medium">Ajouter une photo</span>
            </button>
          )}
          <input ref={editImageRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingEditImage(f); }}
          />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Titre</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="handwritten text-xl h-10 mt-1" />
            </div>
            <div className="w-20">
              <Label className="text-xs text-muted-foreground">Pers.</Label>
              <Input type="number" value={editServings} onChange={(e) => setEditServings(e.target.value)} className="h-10 mt-1" />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Prep (min)</Label>
              <Input type="number" value={editPrepTime} onChange={(e) => setEditPrepTime(e.target.value)} className="mt-1" />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Cuisson (min)</Label>
              <Input type="number" value={editCookTime} onChange={(e) => setEditCookTime(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="mt-1" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Ingredients</Label>
            <div className="space-y-1.5 mt-2">
              {editIngredients.map((ing, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={ing.name} onChange={(e) => { const u = [...editIngredients]; u[i] = { ...u[i], name: e.target.value }; setEditIngredients(u); }} placeholder="Nom" className="flex-1 h-8 text-sm" />
                  <Input value={ing.quantity} onChange={(e) => { const u = [...editIngredients]; u[i] = { ...u[i], quantity: e.target.value }; setEditIngredients(u); }} placeholder="Qte" className="w-16 h-8 text-sm" />
                  <Input value={ing.unit} onChange={(e) => { const u = [...editIngredients]; u[i] = { ...u[i], unit: e.target.value }; setEditIngredients(u); }} placeholder="Unite" className="w-16 h-8 text-sm" />
                  <button onClick={() => setEditIngredients(editIngredients.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/10">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditIngredients([...editIngredients, { name: "", quantity: "", unit: "" }])}>
                <Plus className="h-3 w-3 mr-1" />Ingredient
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Etapes</Label>
            <div className="space-y-1.5 mt-2">
              {editSteps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-xs text-muted-foreground mt-2 w-5 shrink-0">{i + 1}.</span>
                  <Textarea value={step} onChange={(e) => { const u = [...editSteps]; u[i] = e.target.value; setEditSteps(u); }} rows={2} className="flex-1 text-sm" />
                  <button onClick={() => setEditSteps(editSteps.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/10 mt-1">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditSteps([...editSteps, ""])}>
                <Plus className="h-3 w-3 mr-1" />Etape
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={saveEdits}>
              <Check className="h-4 w-4 mr-1.5" />Enregistrer
            </Button>
            <Button size="sm" variant="outline" onClick={cancelEdits}>Annuler</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── View mode ──
  return (
    <div className="recipe-card group/card">
      {/* Recipe image or placeholder */}
      <div className="relative group/img cursor-pointer" onClick={onOpenDetail}>
        {recipe.image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.image}
              alt={recipe.title}
              className="w-full h-44 object-cover"
            />
          </>
        ) : (
          <div className="recipe-thumbnail-placeholder">
            <UtensilsCrossed className="h-10 w-10 text-orange-300 relative z-10" />
          </div>
        )}
        {/* Planned badge on image */}
        {recipe.planned && activeTab === "prevues" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-primary text-white text-xs font-medium px-2.5 py-1 rounded-full z-10">
            <CalendarCheck className="h-3 w-3" />
            Prévue
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); cardImageRef.current?.click(); }}
          className="absolute bottom-2 right-2 p-1.5 bg-black/30 backdrop-blur-sm rounded-full text-white opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-black/50 z-10"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
        <input ref={cardImageRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadImage(recipe.id, f); }}
        />
      </div>

      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 cursor-pointer min-w-0" onClick={onOpenDetail}>
            <h2 className="handwritten text-2xl font-semibold leading-tight">
              {recipe.title}
            </h2>
            {(recipe.prepTime || recipe.cookTime) && (
              <div className="flex gap-3 mt-1.5">
                {recipe.prepTime && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{recipe.prepTime} min prep
                  </span>
                )}
                {recipe.cookTime && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{recipe.cookTime} min cuisson
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />{recipe.servings}
            </span>
            <Dialog open={enrichOpen} onOpenChange={(open) => { setEnrichOpen(open); if (!open) { setEnrichUrl(""); setEnrichError(""); setEnrichResult(null); } }}>
              <DialogTrigger asChild>
                <button
                  className="p-1.5 rounded-lg hover:bg-secondary opacity-0 group-hover/card:opacity-100 transition-opacity"
                  title="Enrichir depuis HelloFresh"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enrichir depuis HelloFresh</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Importe les donnees manquantes (image, etapes, ingredients) depuis une recette HelloFresh.
                  </p>
                  <a
                    href={`https://www.hellofresh.fr/search?q=${encodeURIComponent(recipe.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Chercher &quot;{recipe.title}&quot; sur HelloFresh
                  </a>
                  <Input
                    placeholder="https://www.hellofresh.fr/recipes/..."
                    value={enrichUrl}
                    onChange={(e) => setEnrichUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !enriching) enrichFromHelloFresh(); }}
                    disabled={enriching}
                  />
                  {enrichError && (
                    <p className="text-sm text-destructive">{enrichError}</p>
                  )}
                  {enrichResult && (
                    <div className="text-sm text-green-600 space-y-1">
                      <p className="font-medium">Recette enrichie !</p>
                      <ul className="text-xs space-y-0.5 text-muted-foreground">
                        {enrichResult.image && <li>Image ajoutee</li>}
                        {enrichResult.steps && <li>{enrichResult.stepsCount} etapes importees ({enrichResult.stepImages} avec photo)</li>}
                        {enrichResult.ingredients && enrichResult.ingredients > 0 && <li>{enrichResult.ingredients} ingredients ajoutes</li>}
                        {enrichResult.description && <li>Description ajoutee</li>}
                        {enrichResult.prepTime && <li>Temps de preparation ajoute</li>}
                        {enrichResult.cookTime && <li>Temps de cuisson ajoute</li>}
                      </ul>
                    </div>
                  )}
                  <Button className="w-full" onClick={enrichFromHelloFresh} disabled={enriching || !enrichUrl.trim()}>
                    {enriching ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enrichissement en cours...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Enrichir la recette
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <button
              onClick={startEditing}
              className="p-1.5 rounded-lg hover:bg-secondary opacity-0 group-hover/card:opacity-100 transition-opacity"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => onDelete(recipe.id)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 opacity-0 group-hover/card:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="px-5 pb-3">
        <div className="space-y-0.5">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="flex items-baseline justify-between py-0.5">
              <span className="handwritten text-lg">{ing.name}</span>
              <span className="handwritten text-base text-muted-foreground ml-4 shrink-0 tabular-nums">
                {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""}
              </span>
            </div>
          ))}
        </div>

        {/* Quick add ingredient */}
        {addingIngredient ? (
          <div className="flex gap-2 items-center mt-2">
            <Input placeholder="Nom" value={newIng.name} onChange={(e) => setNewIng({ ...newIng, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") quickAddIngredient(); }}
              className="flex-1 h-8 text-sm" autoFocus
            />
            <Input placeholder="Qte" value={newIng.quantity} onChange={(e) => setNewIng({ ...newIng, quantity: e.target.value })} className="w-16 h-8 text-sm" />
            <Input placeholder="Unite" value={newIng.unit} onChange={(e) => setNewIng({ ...newIng, unit: e.target.value })} className="w-16 h-8 text-sm" />
            <button onClick={quickAddIngredient} className="p-1 rounded hover:bg-secondary">
              <Check className="h-4 w-4 text-primary" />
            </button>
            <button onClick={() => { setAddingIngredient(false); setNewIng({ name: "", quantity: "", unit: "" }); }} className="p-1 rounded hover:bg-secondary">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingIngredient(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 opacity-0 group-hover/card:opacity-100"
          >
            <Plus className="h-3 w-3" />Ajouter un ingredient
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-border" />

      {/* Actions bar */}
      <div className="px-5 py-3 flex items-center gap-2">
        {activeTab === "prevues" ? (
          /* Dans l'onglet Prévues : bouton pour retirer du planning et sauvegarder au catalogue */
          <button
            onClick={onSaveToCatalogue}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <BookMarked className="h-3.5 w-3.5" />
            Sauvegarder au catalogue
          </button>
        ) : (
          /* Dans le catalogue : bouton pour planifier */
          <button
            onClick={togglePlanned}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              recipe.planned
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            {recipe.planned ? "Prévue" : "Planifier"}
          </button>
        )}

        <Dialog>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <ShoppingCart className="h-3.5 w-3.5" />
              Courses
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter les ingrédients aux courses</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <DialogClose asChild>
                <Button className="w-full" onClick={() => onAddToList(recipe.id)}>
                  <Plus className="h-4 w-4 mr-2" />Créer une nouvelle liste
                </Button>
              </DialogClose>
              {lists.filter((l) => l.type === "GROCERY").map((list) => (
                <DialogClose key={list.id} asChild>
                  <Button variant="outline" className="w-full" onClick={() => onAddToList(recipe.id, list.id)}>
                    Ajouter à &quot;{list.name}&quot;
                  </Button>
                </DialogClose>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex-1" />

        {steps.length > 0 && (
          <button
            onClick={onOpenDetail}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Cuisiner
          </button>
        )}
      </div>

      {/* Description */}
      {recipe.description && (
        <div className="px-5 pb-4 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground italic leading-relaxed">{recipe.description}</p>
        </div>
      )}
    </div>
  );
}
