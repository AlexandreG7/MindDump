import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { fetchJowRecipe, isJowUrl, isJowHost } from "@/lib/jow";
import { resolveGroupId, assertGroupMember } from "@/lib/groupAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body?.url || typeof body.url !== "string") {
      return NextResponse.json(
        { error: "URL Jow invalide" },
        { status: 400 }
      );
    }
    const rawUrl: string = body.url;
    // L'hôte doit être Jow (et seulement lui) avant tout fetch.
    if (!isJowHost(rawUrl)) {
      return NextResponse.json(
        { error: "Lien non pris en charge" },
        { status: 400 }
      );
    }
    if (!isJowUrl(rawUrl)) {
      // Page Jow qui n'est pas une recette (liste, accueil) : même contrat que HelloFresh/Quitoque.
      return NextResponse.json(
        { error: "Ce lien n'est pas une recette Jow" },
        { status: 422 }
      );
    }

    const targetUrl = rawUrl.split("?")[0];
    const servings = body.servings || 4;

    const parsed = await fetchJowRecipe(targetUrl, servings);
    if (!parsed) {
      return NextResponse.json(
        { error: "Impossible de récupérer la recette Jow." },
        { status: 502 }
      );
    }

    // Page de liste, d'accueil... : pas de recette à créer.
    if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
      return NextResponse.json(
        { error: "Ce lien n'est pas une recette Jow" },
        { status: 422 }
      );
    }

    const groupId = await resolveGroupId(user.id, body.groupId);
    const groupErr = await assertGroupMember(groupId, user.id);
    if (groupErr) return groupErr;

    const recipe = await prisma.recipe.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        servings: parsed.servings,
        prepTime: parsed.prepTime,
        cookTime: parsed.cookTime,
        steps: JSON.stringify(parsed.steps),
        image: parsed.heroImage,
        planned: body.planned === true,
        inCatalog: body.inCatalog === undefined ? true : body.inCatalog === true,
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
    console.error("[import-jow]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
