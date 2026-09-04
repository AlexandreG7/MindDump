import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { parseHelloFreshPage, fetchHelloFreshPage } from "@/lib/hellofresh";

export const dynamic = "force-dynamic";

function extractRecipeId(url: string): string | null {
  const match = url.match(/([0-9a-f]{20,})(?:\?|$)/);
  return match ? match[1] : null;
}

interface HFStep {
  index: number;
  instructionsMarkdown?: string;
  instructions?: string;
  images?: { link?: string; path?: string }[];
}

interface HFIngredient {
  name?: string;
  slug?: string;
}

interface HFYield {
  amount?: number;
  unit?: string;
  ingredient?: HFIngredient;
}

interface HFRecipeIngredient {
  name?: string;
  yields?: HFYield[];
}

interface HFRecipeAPI {
  name?: string;
  description?: string;
  descriptionMarkdown?: string;
  headline?: string;
  prepTime?: string;
  totalTime?: string;
  servings?: number;
  yields?: number;
  imagePath?: string;
  imageLink?: string;
  steps?: HFStep[];
  ingredients?: HFRecipeIngredient[];
}

async function fetchFromHelloFreshAPI(recipeId: string): Promise<HFRecipeAPI | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      `https://gw.hellofresh.com/api/recipes/${recipeId}?country=FR&locale=fr-FR`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function parseAPIResponse(data: HFRecipeAPI) {
  const title = data.name || "Recette sans titre";
  const description = data.headline || data.description || null;

  let heroImage: string | null = null;
  if (data.imagePath) {
    heroImage = `https://img.hellofresh.com/q_auto,f_auto,w_1200/${data.imagePath}`;
  } else if (data.imageLink) {
    heroImage = data.imageLink;
  }

  let totalTime: number | null = null;
  if (data.totalTime) {
    const tm = data.totalTime.match(/PT(\d+)M/);
    if (tm) totalTime = parseInt(tm[1]);
  } else if (data.prepTime) {
    const tm = data.prepTime.match(/PT(\d+)M/);
    if (tm) totalTime = parseInt(tm[1]);
  }

  const servings = data.yields || data.servings || 2;

  const steps: { text: string; image: string | null }[] = [];
  if (data.steps) {
    const sorted = [...data.steps].sort((a, b) => a.index - b.index);
    for (const step of sorted) {
      const text = step.instructionsMarkdown || step.instructions || "";
      let image: string | null = null;
      if (step.images?.[0]) {
        const img = step.images[0];
        if (img.link) {
          image = img.link;
        } else if (img.path) {
          image = `https://img.hellofresh.com/q_auto,f_auto,w_750/${img.path}`;
        }
      }
      if (text || image) steps.push({ text, image });
    }
  }

  const ingredients: { name: string; quantity: string; unit: string }[] = [];
  if (data.ingredients) {
    for (const ing of data.ingredients) {
      const name = ing.name || "";
      if (!name) continue;
      let quantity = "1";
      let unit = "";
      if (ing.yields?.[0]) {
        const y = ing.yields[0];
        if (y.amount) quantity = String(y.amount);
        if (y.unit) unit = y.unit;
      }
      ingredients.push({ name, quantity, unit });
    }
  }

  return {
    title,
    description,
    prepTime: totalTime ? Math.round(totalTime * 0.4) : null,
    cookTime: totalTime ? Math.round(totalTime * 0.6) : null,
    servings,
    ingredients,
    steps,
    heroImage,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body?.url || !String(body.url).includes("hellofresh")) {
      return NextResponse.json(
        { error: "URL HelloFresh invalide" },
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

    const targetUrl = String(body.url).split("?")[0];
    const recipeHFId = extractRecipeId(targetUrl);

    let scraped: {
      title: string;
      description: string | null;
      prepTime: number | null;
      cookTime: number | null;
      servings: number;
      ingredients: { name: string; quantity: string; unit: string }[];
      steps: { text: string; image: string | null }[];
      heroImage: string | null;
    } | null = null;

    // Strategy 1: Try HelloFresh API (JSON, less likely to be blocked)
    if (recipeHFId) {
      const apiData = await fetchFromHelloFreshAPI(recipeHFId);
      if (apiData?.name) {
        scraped = parseAPIResponse(apiData);
      }
    }

    // Strategy 2: HTML scraping fallback
    if (!scraped) {
      try {
        const html = await fetchHelloFreshPage(targetUrl);
        scraped = parseHelloFreshPage(html);
      } catch {
        // Both strategies failed
      }
    }

    if (!scraped) {
      return NextResponse.json(
        { error: "Impossible de recuperer les donnees HelloFresh (403). Essayez depuis votre navigateur." },
        { status: 502 }
      );
    }

    // Enrich: only fill in missing data, always update images
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

    // Steps: replace if current steps are empty or have no images
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

    // Ingredients: add if recipe has none
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
