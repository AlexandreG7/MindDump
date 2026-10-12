"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Check, Download, ExternalLink, Loader2, Plus, Trash2, X } from "lucide-react";

// Modification d'une recette et enrichissement HelloFresh depuis le catalogue.
// Logique reprise telle quelle de l'ancienne carte ; seul le contenant change
// (boîtes de dialogue au lieu d'une carte qui se déplie).

export interface Ingredient {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
}

export interface CatalogRecipe {
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
  favorite: boolean;
  createdAt: string;
  ingredients: Ingredient[];
}

function stepTexts(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return parsed.map((s: string | { text: string }) => (typeof s === "string" ? s : s.text));
  } catch {
    return [];
  }
}

export function RecipeEditDialog({
  recipe,
  open,
  onOpenChange,
  onUpdate,
  onUploadImage,
  onRemoveImage,
}: {
  recipe: CatalogRecipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onUploadImage: (recipeId: string, file: File) => void;
  onRemoveImage: (recipeId: string) => void;
}) {
  const [editTitle, setEditTitle] = useState(recipe.title);
  const [editServings, setEditServings] = useState(String(recipe.servings));
  const [editPrepTime, setEditPrepTime] = useState(String(recipe.prepTime || ""));
  const [editCookTime, setEditCookTime] = useState(String(recipe.cookTime || ""));
  const [editDescription, setEditDescription] = useState(recipe.description || "");
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>(recipe.ingredients.map((i) => ({ ...i })));
  const [editSteps, setEditSteps] = useState<string[]>(() => stepTexts(recipe.steps));
  const [pendingEditImage, setPendingEditImage] = useState<File | null>(null);
  const editImageRef = useRef<HTMLInputElement>(null);

  // À chaque ouverture, le formulaire repart de la recette telle qu'elle est enregistrée.
  useEffect(() => {
    if (!open) return;
    setEditTitle(recipe.title);
    setEditServings(String(recipe.servings));
    setEditPrepTime(String(recipe.prepTime || ""));
    setEditCookTime(String(recipe.cookTime || ""));
    setEditDescription(recipe.description || "");
    setEditIngredients(recipe.ingredients.map((i) => ({ ...i })));
    setEditSteps(stepTexts(recipe.steps));
    setPendingEditImage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    onOpenChange(false);
  };

  const cancelEdits = () => {
    setPendingEditImage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la recette</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
        {/* Edit image */}
        <div>
          {pendingEditImage ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(pendingEditImage)} alt="Aperçu" className="w-full h-44 object-cover rounded-xl" />
              <button aria-label="Retirer la photo"
                onClick={() => { setPendingEditImage(null); if (editImageRef.current) editImageRef.current.value = ""; }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : recipe.image ? (
            <div className="relative group/img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={recipe.image} alt={recipe.title} className="w-full h-44 object-cover rounded-xl" />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover/img:opacity-100 touch:opacity-100 touch:items-end touch:justify-end touch:p-2">
                <button aria-label="Changer la photo"
                  onClick={() => editImageRef.current?.click()}
                  className="p-2 bg-card/90 rounded-full text-foreground hover:bg-card"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <button aria-label="Supprimer la photo"
                  onClick={() => onRemoveImage(recipe.id)}
                  className="p-2 bg-card/90 rounded-full text-destructive hover:bg-card"
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

        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Titre</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-10 mt-1" />
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
            <Label className="text-xs text-muted-foreground">Ingrédients</Label>
            <div className="space-y-1.5 mt-2">
              {editIngredients.map((ing, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={ing.name} onChange={(e) => { const u = [...editIngredients]; u[i] = { ...u[i], name: e.target.value }; setEditIngredients(u); }} placeholder="Nom" className="flex-1 h-8 text-sm" />
                  <Input value={ing.quantity} onChange={(e) => { const u = [...editIngredients]; u[i] = { ...u[i], quantity: e.target.value }; setEditIngredients(u); }} placeholder="Qté" className="w-16 h-8 text-sm" />
                  <Input value={ing.unit} onChange={(e) => { const u = [...editIngredients]; u[i] = { ...u[i], unit: e.target.value }; setEditIngredients(u); }} placeholder="Unité" className="w-16 h-8 text-sm" />
                  <button aria-label="Retirer l'ingrédient" onClick={() => setEditIngredients(editIngredients.filter((_, j) => j !== i))} className="p-1.5 rounded-md hover:bg-destructive/10">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditIngredients([...editIngredients, { name: "", quantity: "", unit: "" }])}>
                <Plus className="h-3 w-3 mr-1" />Ingrédient
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Étapes</Label>
            <div className="space-y-1.5 mt-2">
              {editSteps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-xs text-muted-foreground mt-2 w-5 shrink-0">{i + 1}.</span>
                  <Textarea value={step} onChange={(e) => { const u = [...editSteps]; u[i] = e.target.value; setEditSteps(u); }} rows={2} className="flex-1 text-sm" />
                  <button aria-label="Retirer l'étape" onClick={() => setEditSteps(editSteps.filter((_, j) => j !== i))} className="p-1.5 rounded-md hover:bg-destructive/10 mt-1">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditSteps([...editSteps, ""])}>
                <Plus className="h-3 w-3 mr-1" />Étape
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
      </DialogContent>
    </Dialog>
  );
}

export function EnrichDialog({
  recipe,
  open,
  onOpenChange,
  onEnriched,
}: {
  recipe: CatalogRecipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnriched: () => void;
}) {
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setEnrichUrl("");
          setEnrichError("");
          setEnrichResult(null);
        }
      }}
    >
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
                    <div className="text-sm text-green-600 dark:text-green-400 space-y-1">
                      <p className="font-medium">Recette enrichie !</p>
                      <ul className="text-xs space-y-0.5 text-muted-foreground">
                        {enrichResult.image && <li>Image ajoutée</li>}
                        {enrichResult.steps && <li>{enrichResult.stepsCount} etapes importees ({enrichResult.stepImages} avec photo)</li>}
                        {enrichResult.ingredients && enrichResult.ingredients > 0 && <li>{enrichResult.ingredients} ingredients ajoutes</li>}
                        {enrichResult.description && <li>Description ajoutée</li>}
                        {enrichResult.prepTime && <li>Temps de préparation ajouté</li>}
                        {enrichResult.cookTime && <li>Temps de cuisson ajouté</li>}
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
  );
}
