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
} from "lucide-react";
import { RecipeView, type RecipeViewData } from "@/components/recipes/RecipeView";
import { ShareRecipeDialog } from "@/components/recipes/ShareRecipeDialog";

interface Recipe extends RecipeViewData {
  id: string;
  planned: boolean;
  inCatalog: boolean;
  shareToken: string | null;
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isReady } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchRecipe = useCallback(() => {
    fetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then(setRecipe);
  }, [id]);

  useEffect(() => {
    if (isReady && id) fetchRecipe();
  }, [isReady, id, fetchRecipe]);

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

  const addToShoppingList = async () => {
    await fetch(`/api/recipes/${id}/to-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: null }),
    });
    fetchRecipe();
  };

  const uploadImage = async (file: File) => {
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`/api/recipes/${id}/image`, {
      method: "POST",
      body: formData,
    });
    setUploadingImage(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      alert(error || "Impossible d'enregistrer l'image");
      return;
    }
    fetchRecipe();
  };

  return (
    <>
      <RecipeView
        recipe={recipe}
        onBack={() => router.back()}
        heroOverlay={
          <>
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              className={`absolute bottom-4 right-4 z-20 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-opacity [@media(hover:none)]:opacity-100 ${
                uploadingImage ? "opacity-100 animate-pulse" : "opacity-0 group-hover/hero:opacity-100"
              }`}
              title={recipe.image ? "Changer la photo" : "Ajouter une photo"}
            >
              <Camera className="h-4 w-4" />
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
              onClick={() => setShareOpen(true)}
              className={`p-2.5 rounded-full backdrop-blur-sm transition-colors ${
                recipe.shareToken
                  ? "bg-sky-500 text-white hover:bg-sky-600"
                  : "bg-black/30 text-white hover:bg-black/50"
              }`}
              title="Partager"
            >
              <Share2 className="h-5 w-5" />
            </button>
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
