import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { parseHelloFreshPage, fetchHelloFreshPage } from "@/lib/hellofresh";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body?.url || !String(body.url).includes("hellofresh.fr/recipes/")) {
      return NextResponse.json(
        { error: "URL HelloFresh invalide" },
        { status: 400 }
      );
    }

    const targetUrl = String(body.url).split("?")[0];

    let html: string;
    try {
      html = await fetchHelloFreshPage(targetUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur reseau";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const scraped = parseHelloFreshPage(html);

    const recipe = await prisma.recipe.create({
      data: {
        title: scraped.title,
        description: scraped.description,
        servings: scraped.servings,
        prepTime: scraped.prepTime,
        cookTime: scraped.cookTime,
        steps: JSON.stringify(scraped.steps),
        image: scraped.heroImage,
        planned: false,
        userId: user.id,
        groupId: body.groupId || null,
      },
    });

    if (scraped.ingredients.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: scraped.ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          recipeId: recipe.id,
        })),
      });
    }

    return NextResponse.json({
      id: recipe.id,
      title: recipe.title,
      ingredientCount: scraped.ingredients.length,
      stepCount: scraped.steps.length,
      hasImage: !!scraped.heroImage,
      stepImages: scraped.steps.filter((s) => s.image).length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Erreur serveur: ${e instanceof Error ? e.message : "inconnue"}` },
      { status: 500 }
    );
  }
}
