import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { parseQuitoqueRecipe } from "@/lib/quitoque";
import { resolveGroupId, assertGroupMember } from "@/lib/groupAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body?.url || !String(body.url).includes("quitoque")) {
      return NextResponse.json(
        { error: "URL Quitoque invalide" },
        { status: 400 }
      );
    }

    const targetUrl = String(body.url).split("?")[0];
    const servings = body.servings || 2;

    const parsed = await parseQuitoqueRecipe(targetUrl);

    if (!parsed) {
      return NextResponse.json(
        { error: "Impossible de récupérer la recette Quitoque." },
        { status: 502 }
      );
    }

    const groupId = await resolveGroupId(user.id, body.groupId);
    const groupErr = await assertGroupMember(groupId, user.id);
    if (groupErr) return groupErr;

    const recipe = await prisma.recipe.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        servings,
        prepTime: parsed.prepTime,
        cookTime: parsed.cookTime,
        steps: JSON.stringify(parsed.steps),
        image: parsed.heroImage,
        planned: false,
        userId: user.id,
        groupId,
      },
    });

    if (parsed.ingredients.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: parsed.ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          recipeId: recipe.id,
        })),
      });
    }

    return NextResponse.json({
      id: recipe.id,
      title: parsed.title,
      ingredientCount: parsed.ingredients.length,
      stepCount: parsed.steps.length,
      hasImage: !!parsed.heroImage,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Erreur serveur: ${e instanceof Error ? e.message : "inconnue"}` },
      { status: 500 }
    );
  }
}
