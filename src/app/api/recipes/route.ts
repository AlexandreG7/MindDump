import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, buildResourceWhere, resolveGroupId } from "@/lib/groupAuth";
import { fetchEnrichedData } from "@/lib/hellofresh";
import { isJowUrl, fetchJowRecipe } from "@/lib/jow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const groupId = new URL(req.url).searchParams.get("groupId");

  if (groupId) {
    const err = await assertGroupMember(groupId, user.id);
    if (err) return err;
  }

  const where = await buildResourceWhere(user.id, groupId);

  const recipes = await prisma.recipe.findMany({
    where,
    include: { ingredients: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recipes);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const groupId = await resolveGroupId(user.id, body.groupId);

  const err = await assertGroupMember(groupId, user.id);
  if (err) return err;

  const stepsValue = typeof body.steps === "string" ? body.steps : JSON.stringify(body.steps || []);
  const recipe = await prisma.recipe.create({
    data: {
      title: body.title,
      description: body.description || null,
      servings: body.servings || 4,
      prepTime: body.prepTime || null,
      cookTime: body.cookTime || null,
      steps: stepsValue,
      image: body.image || null,
      planned: body.planned === true,
      inCatalog: body.inCatalog === true,
      userId: user.id,
      groupId,
      ingredients: {
        create: (body.ingredients || []).map(
          (ing: { name: string; quantity: string; unit?: string }) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit || null,
          })
        ),
      },
    },
    include: { ingredients: true },
  });

  // Auto-enrich from external source if sourceUrl is provided
  let enriched = null;
  const sourceUrl = body.sourceUrl;
  if (sourceUrl && isJowUrl(String(sourceUrl))) {
    try {
      const data = await fetchJowRecipe(String(sourceUrl), recipe.servings);
      if (data) {
        const updates: Record<string, unknown> = {};
        if (!recipe.image && data.heroImage) updates.image = data.heroImage;
        if (!recipe.description && data.description) updates.description = data.description;
        if (!recipe.prepTime && data.prepTime) updates.prepTime = data.prepTime;
        if (!recipe.cookTime && data.cookTime) updates.cookTime = data.cookTime;

        let currentSteps: { text: string; image?: string | null }[] = [];
        try { currentSteps = JSON.parse(recipe.steps); } catch { currentSteps = []; }
        if (data.steps.length > 0 && currentSteps.length === 0) {
          updates.steps = JSON.stringify(data.steps);
        }

        if (recipe.ingredients.length === 0 && data.ingredients.length > 0) {
          await prisma.recipeIngredient.createMany({
            data: data.ingredients.map((ing) => ({
              name: ing.name, quantity: ing.quantity, unit: ing.unit || null, recipeId: recipe.id,
            })),
          });
        }

        if (Object.keys(updates).length > 0) {
          await prisma.recipe.update({ where: { id: recipe.id }, data: updates });
        }

        enriched = {
          image: !!updates.image, description: !!updates.description,
          steps: !!updates.steps, stepsCount: data.steps.length, stepImages: 0,
          ingredients: recipe.ingredients.length === 0 ? data.ingredients.length : 0,
          prepTime: !!updates.prepTime, cookTime: !!updates.cookTime,
        };
      }
    } catch { /* Enrichment failed silently */ }
  } else if (sourceUrl && String(sourceUrl).includes("hellofresh")) {
    try {
      const data = await fetchEnrichedData(
        String(sourceUrl),
        recipe.servings,
        body.hfToken
      );
      if (data) {
        const updates: Record<string, unknown> = {};
        if (!recipe.image && data.heroImage) updates.image = data.heroImage;
        if (!recipe.description && data.description)
          updates.description = data.description;
        if (!recipe.prepTime && data.prepTime) updates.prepTime = data.prepTime;
        if (!recipe.cookTime && data.cookTime) updates.cookTime = data.cookTime;

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
          data.steps.length > 0 &&
          (currentSteps.length === 0 || !hasStepImages)
        ) {
          updates.steps = JSON.stringify(data.steps);
        }

        if (recipe.ingredients.length === 0 && data.ingredients.length > 0) {
          await prisma.recipeIngredient.createMany({
            data: data.ingredients.map((ing) => ({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit || null,
              recipeId: recipe.id,
            })),
          });
        }

        if (Object.keys(updates).length > 0) {
          await prisma.recipe.update({
            where: { id: recipe.id },
            data: updates,
          });
        }

        enriched = {
          image: !!updates.image,
          description: !!updates.description,
          steps: !!updates.steps,
          stepsCount: data.steps.length,
          stepImages: data.steps.filter((s) => s.image).length,
          ingredients: recipe.ingredients.length === 0 ? data.ingredients.length : 0,
          prepTime: !!updates.prepTime,
          cookTime: !!updates.cookTime,
        };
      }
    } catch {
      // Enrichment failed silently — recipe is still created
    }
  }

  const result = await prisma.recipe.findUnique({
    where: { id: recipe.id },
    include: { ingredients: true },
  });

  return NextResponse.json({ ...result, enriched }, { status: 201 });
}
