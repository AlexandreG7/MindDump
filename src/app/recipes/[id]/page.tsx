"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import {
  CalendarPlus,
  ShoppingCart,
  BookMarked,
  Camera,
  Share2,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RecipeView, type RecipeViewData } from "@/components/recipes/RecipeView";
import { ShareRecipeDialog } from "@/components/recipes/ShareRecipeDialog";
import { useFeedback } from "@/components/ui/feedback";
import { prepareRecipePhoto } from "@/lib/image";

interface Recipe extends RecipeViewData {
  id: string;
  planned: boolean;
  inCatalog: boolean;
  favorite: boolean;
  shareToken: string | null;
}

export default function RecipeDetailPage() {
  const { toast } = useFeedback();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isReady } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // « Cuisiner » depuis le catalogue arrive ici avec ?cook=1 (lu une fois, sans Suspense).
  const [autoCook, setAutoCook] = useState(false);
  useEffect(() => {
    setAutoCook(new URLSearchParams(window.location.search).has("cook"));
  }, []);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchRecipe = useCallback(async () => {
    try {
      const res = await fetch(`/api/recipes/${id}`);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setRecipe(await res.json());
    } catch {
      setLoadError(true);
    }
  }, [id]);

  useEffect(() => {
    if (isReady && id) fetchRecipe();
  }, [isReady, id, fetchRecipe]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="font-medium text-foreground">Recette introuvable</p>
        <p className="text-sm text-muted-foreground">
          Elle a peut-être été supprimée, ou tu n&apos;y as pas accès.
        </p>
        <button
          onClick={() => router.push("/recipes")}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          Retour aux recettes
        </button>
      </div>
    );
  }

  if (!isReady || !recipe) return null;

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

  const toggleFavorite = async () => {
    setRecipe({ ...recipe, favorite: !recipe.favorite });
    await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !recipe.favorite }),
    });
    fetchRecipe();
  };

  const addToShoppingList = async () => {
    const res = await fetch(`/api/recipes/${id}/to-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: null }),
    });
    if (!res.ok) {
      toast("Impossible d'ajouter les ingrédients aux courses", "error");
      return;
    }
    toast("Ingrédients ajoutés aux courses", "success", { label: "Voir la liste", onClick: () => router.push("/lists") });
    fetchRecipe();
  };

  const uploadImage = async (file: File) => {
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", await prepareRecipePhoto(file), "photo.jpg");
    const res = await fetch(`/api/recipes/${id}/image`, {
      method: "POST",
      body: formData,
    });
    setUploadingImage(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      toast(error || "Impossible d'enregistrer l'image", "error");
      return;
    }
    fetchRecipe();
  };

  const pill =
    "inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-[background-color,transform] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const pillOff = "bg-secondary text-secondary-foreground hover:bg-accent";
  const pillOn = "bg-tone-meal-soft text-tone-meal-ink hover:brightness-95";
  const round =
    "flex h-12 w-12 items-center justify-center rounded-full bg-card/90 text-foreground shadow-surface backdrop-blur-sm transition-[transform,background-color] duration-150 hover:bg-card active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      <RecipeView
        recipe={recipe}
        autoCook={autoCook}
        onBack={() => router.back()}
        heroOverlay={
          <>
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              aria-label={recipe.image ? "Changer la photo" : "Ajouter une photo"}
              className={cn(
                "absolute bottom-2 right-2 z-20 flex h-12 w-12 items-center justify-center rounded-full text-white transition-opacity",
                uploadingImage ? "animate-pulse opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover/hero:opacity-100 touch:opacity-100"
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                <Camera className="h-3.5 w-3.5" />
              </span>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage(f);
                e.target.value = "";
              }}
            />
          </>
        }
        heroActions={
          <>
            <button
              onClick={toggleFavorite}
              className={cn(round, recipe.favorite && "bg-rose-500 text-white hover:bg-rose-600")}
              aria-label={recipe.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-pressed={recipe.favorite}
            >
              <Heart className={cn("h-5 w-5", recipe.favorite && "fill-current")} />
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className={cn(round, recipe.shareToken && "bg-sky-500 text-white hover:bg-sky-600")}
              aria-label={recipe.shareToken ? "Partager (lien actif)" : "Partager"}
            >
              <Share2 className="h-5 w-5" />
            </button>
          </>
        }
        actions={
          <>
            <button onClick={togglePlanned} aria-pressed={recipe.planned} className={cn(pill, recipe.planned ? pillOn : pillOff)}>
              <CalendarPlus className="h-4 w-4" />
              {recipe.planned ? "Prévue" : "Planifier"}
            </button>
            <button onClick={addToShoppingList} className={cn(pill, pillOff)}>
              <ShoppingCart className="h-4 w-4" />
              Courses
            </button>
            <button onClick={toggleCatalog} aria-pressed={recipe.inCatalog} className={cn(pill, recipe.inCatalog ? pillOn : pillOff)}>
              <BookMarked className="h-4 w-4" />
              Catalogue
            </button>
          </>
        }
      />
      <ShareRecipeDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        shareToken={recipe.shareToken}
        onChange={fetchRecipe}
      />
    </>
  );
}
