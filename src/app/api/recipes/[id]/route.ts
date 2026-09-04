import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  fetchEnrichedData,
  type EnrichedData,
} from "@/lib/hellofresh";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: user.id },
    include: { ingredients: true },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  return NextResponse.json(recipe);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();

  if (body.ingredients) {
    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: params.id },
    });
    await prisma.recipeIngredient.createMany({
      data: body.ingredients.map(
        (ing: { name: string; quantity: string; unit?: string }) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit || null,
          recipeId: params.id,
        })
      ),
    });
  }

  if (body.addIngredients) {
    await prisma.recipeIngredient.createMany({
      data: body.addIngredients.map(
        (ing: { name: string; quantity: string; unit?: string }) => ({
          name: ing.name,
          quantity: ing.quantity || "1",
          unit: ing.unit || null,
          recipeId: params.id,
        })
      ),
    });
  }

  await prisma.recipe.updateMany({
    where: { id: params.id, userId: user.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.servings !== undefined && { servings: body.servings }),
      ...(body.prepTime !== undefined && { prepTime: body.prepTime }),
      ...(body.cookTime !== undefined && { cookTime: body.cookTime }),
      ...(body.steps !== undefined && { steps: JSON.stringify(body.steps) }),
      ...(body.image !== undefined && { image: body.image }),
      ...(body.planned !== undefined && { planned: body.planned }),
      ...(body.groupId !== undefined && { groupId: body.groupId || null }),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.recipe.deleteMany({
    where: { id: params.id, userId: user.id },
  });

  return NextResponse.json({ success: true });
}

// ── Enrichment from HelloFresh ──

export async function PUT(
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
      return NextResponse.json(
        { error: "Recette non trouvee" },
        { status: 404 }
      );
    }

    const scraped: EnrichedData | null = await fetchEnrichedData(
      String(body.url),
      recipe.servings,
      body.hfToken
    );

    if (!scraped) {
      return NextResponse.json(
        {
          error:
            "Impossible de recuperer les donnees HelloFresh. Le serveur est peut-etre bloque.",
        },
        { status: 502 }
      );
    }

    const updates: Record<string, unknown> = {};
    if ((!recipe.image || body.forceImage) && scraped.heroImage)
      updates.image = scraped.heroImage;
    if (!recipe.description && scraped.description)
      updates.description = scraped.description;
    if (!recipe.prepTime && scraped.prepTime)
      updates.prepTime = scraped.prepTime;
    if (!recipe.cookTime && scraped.cookTime)
      updates.cookTime = scraped.cookTime;

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
      await prisma.recipe.update({ where: { id: recipe.id }, data: updates });
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
      {
        error: `Erreur serveur: ${e instanceof Error ? e.message : "inconnue"}`,
      },
      { status: 500 }
    );
  }
}
