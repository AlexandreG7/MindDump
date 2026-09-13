"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookmarkPlus, Check, Loader } from "lucide-react";
import { RecipeView, type RecipeViewData } from "@/components/recipes/RecipeView";

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true" && process.env.NODE_ENV !== "production";

export function SharedRecipe({ token, recipe }: { token: string; recipe: RecipeViewData }) {
  const router = useRouter();
  const { status } = useSession();
  const isLoggedIn = skipAuth || status === "authenticated";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveToMyRecipes = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/shared/recipes/${token}`)}`);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/shared/recipes/${token}`, { method: "POST" });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      alert(error || "Impossible d'ajouter la recette");
      return;
    }
    const { id } = await res.json();
    setSaved(true);
    setTimeout(() => router.push(`/recipes/${id}`), 800);
  };

  return (
    // Sans session la barre de navigation est masquée : on récupère l'espace
    // que <main> lui réserve en haut sur mobile (pt-20).
    <div className={isLoggedIn ? undefined : "-mt-16 md:mt-0"}>
      <RecipeView
        recipe={recipe}
        heroActions={
          <button
            onClick={saveToMyRecipes}
            disabled={saving || saved}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-black/30 backdrop-blur-sm text-white text-sm font-medium hover:bg-black/50 transition-colors"
          >
            {saved ? (
              <Check className="h-4 w-4" />
            ) : saving ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <BookmarkPlus className="h-4 w-4" />
            )}
            {saved ? "Ajoutée" : "Ajouter à mes recettes"}
          </button>
        }
      />
    </div>
  );
}
