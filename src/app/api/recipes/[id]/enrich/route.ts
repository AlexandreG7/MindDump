import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  fetchHelloFreshPage,
  parseHelloFreshPage,
  fetchFromHelloFreshAPI,
  parseAPIResponse,
  extractRecipeId,
  type EnrichedData,
} from "@/lib/hellofresh";
import { isJowUrl, fetchJowRecipe } from "@/lib/jow";

export const dynamic = "force-dynamic";


export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    const url = String(body?.url || "");
    const isJow = isJowUrl(url);
    const isHF = url.includes("hellofresh");
    if (!body?.url || (!isJow && !isHF)) {
      return NextResponse.json(
        { error: "URL invalide — Jow ou HelloFresh attendu" },
        { status: 400 }
      );
    }

    const recipe = await prisma.recipe.findFirst({
      where: { id: params.id, userId: user.id },
      include: { ingredients: true },
    });
    if (!recipe) {
      return NextResponse.json({ error: "Recette non trouvee" }, { status: 404 });
    }

    const targetUrl = url.split("?")[0];
    let scraped: EnrichedData | null = null;

    if (isJow) {
      const jowData = await fetchJowRecipe(targetUrl, recipe.servings);
      if (jowData) scraped = jowData;
    } else {
      const recipeHFId = extractRecipeId(targetUrl);
      if (recipeHFId) {
        const apiData = await fetchFromHelloFreshAPI(recipeHFId);
        if (apiData?.name) scraped = parseAPIResponse(apiData, recipe.servings);
      }
      if (!scraped) {
        try {
          const html = await fetchHelloFreshPage(targetUrl);
          scraped = parseHelloFreshPage(html);
        } catch { /* Both strategies failed */ }
      }
    }

    if (!scraped) {
      return NextResponse.json(
        { error: "Impossible de récupérer les données de la recette." },
        { status: 502 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (!recipe.image && scraped.heroImage) {
      updates.image = scraped.heroImage;
    }
    if (body.forceImage && scraped.heroImage) {
      updates.image = scraped.heroImage;
    }

    if (!recipe.description && scraped.description) {
      updates.description = scraped.description;
    }
    if (!recipe.prepTime && scraped.prepTime) {
      updates.prepTime = scraped.prepTime;
    }
    if (!recipe.cookTime && scraped.cookTime) {
      updates.cookTime = scraped.cookTime;
    }

    let currentSteps: { text: string; image?: string | null }[] = [];
    try {
      currentSteps = JSON.parse(recipe.steps);
    } catch {
      currentSteps = [];
    }

    const hasStepImages = currentSteps.some(
      (s) => typeof s === "object" && s.image
    );
    if (
      scraped.steps.length > 0 &&
      (currentSteps.length === 0 || !hasStepImages)
    ) {
      updates.steps = JSON.stringify(scraped.steps);
    }

    let addedIngredients = 0;
    if (recipe.ingredients.length === 0 && scraped.ingredients.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: scraped.ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit || null,
          recipeId: recipe.id,
        })),
      });
      addedIngredients = scraped.ingredients.length;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: updates,
      });
    }

    return NextResponse.json({
      success: true,
      enriched: {
        image: !!updates.image,
        description: !!updates.description,
        steps: !!updates.steps,
        stepsCount: scraped.steps.length,
        stepImages: scraped.steps.filter((s) => s.image).length,
        ingredients: addedIngredients,
        prepTime: !!updates.prepTime,
        cookTime: !!updates.cookTime,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Erreur serveur: ${e instanceof Error ? e.message : "inconnue"}` },
      { status: 500 }
    );
  }
}
