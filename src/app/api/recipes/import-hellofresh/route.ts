import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  fetchEnrichedData,
  extractRecipeId,
  fetchHelloFreshPage,
  parseHelloFreshPage,
} from "@/lib/hellofresh";
import { resolveGroupId, assertGroupMember } from "@/lib/groupAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

    const targetUrl = String(body.url).split("?")[0];
    const servings = body.servings || 4;

    // Try API first (works from Hetzner), fall back to HTML scraping
    const enriched = await fetchEnrichedData(targetUrl, servings, body.hfToken);

    if (!enriched) {
      return NextResponse.json(
        { error: "Impossible de recuperer la recette HelloFresh. Le serveur est peut-etre bloque." },
        { status: 502 }
      );
    }

    // Extract title from URL slug or API data
    let title = "Recette HelloFresh";
    const slugMatch = targetUrl.match(/\/recipes\/([^/]+?)(?:-[0-9a-f]{20,})?$/);
    if (slugMatch) {
      title = slugMatch[1]
        .replace(/-and-/g, " & ")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // If API enrichment gave us a description but not a proper title, try HTML as fallback for title
    if (title === "Recette HelloFresh") {
      try {
        const html = await fetchHelloFreshPage(targetUrl);
        const parsed = parseHelloFreshPage(html);
        if (parsed.title && parsed.title !== "Recette sans titre") {
          title = parsed.title;
        }
      } catch {
        // HTML scraping failed (e.g. Hetzner blocked), use slug-derived title
      }
    }

    const groupId = await resolveGroupId(user.id, body.groupId);
    const groupErr = await assertGroupMember(groupId, user.id);
    if (groupErr) return groupErr;

    const recipe = await prisma.recipe.create({
      data: {
        title,
        description: enriched.description,
        servings,
        prepTime: enriched.prepTime,
        cookTime: enriched.cookTime,
        steps: JSON.stringify(enriched.steps),
        image: enriched.heroImage,
        planned: body.planned === true,
        inCatalog: body.inCatalog === undefined ? true : body.inCatalog === true,
        userId: user.id,
        groupId,
      },
    });

    if (enriched.ingredients.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: enriched.ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          recipeId: recipe.id,
        })),
      });
    }

    return NextResponse.json({
      id: recipe.id,
      title,
      ingredientCount: enriched.ingredients.length,
      stepCount: enriched.steps.length,
      hasImage: !!enriched.heroImage,
      stepImages: enriched.steps.filter((s) => s.image).length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Erreur serveur: ${e instanceof Error ? e.message : "inconnue"}` },
      { status: 500 }
    );
  }
}
