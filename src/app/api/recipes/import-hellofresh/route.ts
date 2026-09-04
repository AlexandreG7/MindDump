import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.text();
}

function extractText(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/<[^>]*>/g, "");
}

interface ScrapedRecipe {
  title: string;
  description: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: { text: string; image: string | null }[];
  heroImage: string | null;
  tags: string[];
}

function parseRecipePage(html: string): ScrapedRecipe {
  // Try JSON-LD first
  const jsonLdMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );

  let title = "";
  let description: string | null = null;
  let totalTime: number | null = null;
  let servings = 2;
  const ingredients: { name: string; quantity: string; unit: string }[] = [];
  const steps: { text: string; image: string | null }[] = [];
  let heroImage: string | null = null;
  const tags: string[] = [];

  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const recipe = Array.isArray(jsonLd)
        ? jsonLd.find((item: { "@type"?: string }) => item["@type"] === "Recipe")
        : jsonLd["@type"] === "Recipe"
        ? jsonLd
        : null;

      if (recipe) {
        title = recipe.name || "";
        description = recipe.description || null;
        heroImage = recipe.image?.[0] || recipe.image || null;
        servings = parseInt(recipe.recipeYield) || 2;

        if (recipe.totalTime) {
          const timeMatch = recipe.totalTime.match(/PT(\d+)M/);
          if (timeMatch) totalTime = parseInt(timeMatch[1]);
        }

        if (recipe.recipeIngredient) {
          for (const ing of recipe.recipeIngredient) {
            const parts = ing.match(/^([\d.,/½¼¾⅓⅔]+)?\s*(\S+)?\s+(.+)$/);
            if (parts) {
              ingredients.push({
                quantity: parts[1] || "1",
                unit: parts[2] || "",
                name: parts[3],
              });
            } else {
              ingredients.push({ name: ing, quantity: "1", unit: "" });
            }
          }
        }

        if (recipe.recipeInstructions) {
          for (const step of recipe.recipeInstructions) {
            if (typeof step === "string") {
              steps.push({ text: step, image: null });
            } else if (step.text) {
              steps.push({ text: step.text, image: step.image || null });
            }
          }
        }
      }
    } catch {
      // JSON-LD parse failed, fall through to HTML parsing
    }
  }

  // Fallback / supplement from HTML
  if (!title) {
    title =
      decodeHtml(
        extractText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || ""
      ) || "Recette sans titre";
  }

  if (!description) {
    const subtitle = extractText(
      html,
      /class="[^"]*recipe-subtitle[^"]*"[^>]*>([\s\S]*?)</i
    );
    if (subtitle) description = decodeHtml(subtitle);
  }

  // Extract hero image from HTML if not found in JSON-LD
  if (!heroImage) {
    const heroMatch = html.match(
      /https:\/\/media\.hellofresh\.com\/[^"'\s]*MAIN[^"'\s]*/i
    );
    if (heroMatch) heroImage = heroMatch[0];
  }

  // Extract step images from HTML
  const stepImageRegex =
    /https:\/\/media\.hellofresh\.com\/[^"'\s]*\/step-[^"'\s]*/gi;
  const stepImages: string[] = [];
  let imgMatch;
  while ((imgMatch = stepImageRegex.exec(html)) !== null) {
    const url = imgMatch[0];
    if (!stepImages.includes(url)) stepImages.push(url);
  }

  // Assign step images to steps if steps exist but don't have images
  if (steps.length > 0 && stepImages.length > 0) {
    for (let i = 0; i < steps.length && i < stepImages.length; i++) {
      if (!steps[i].image) steps[i].image = stepImages[i];
    }
  }

  // Parse ingredients from HTML if JSON-LD didn't provide them
  if (ingredients.length === 0) {
    const ingRegex =
      /<div[^>]*data-translation-id="recipe-detail\.ingredients"[\s\S]*?<\/div>/gi;
    let ingMatch;
    while ((ingMatch = ingRegex.exec(html)) !== null) {
      const text = decodeHtml(ingMatch[0]);
      if (text.trim()) {
        ingredients.push({ name: text.trim(), quantity: "1", unit: "" });
      }
    }
  }

  // Parse steps from HTML if JSON-LD didn't provide them
  if (steps.length === 0) {
    const stepRegex =
      /<div[^>]*data-test-id="instruction-step"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
    let stepMatch;
    let stepIdx = 0;
    while ((stepMatch = stepRegex.exec(html)) !== null) {
      const text = decodeHtml(stepMatch[1]).trim();
      if (text) {
        steps.push({
          text,
          image: stepIdx < stepImages.length ? stepImages[stepIdx] : null,
        });
        stepIdx++;
      }
    }
  }

  // Extract time from HTML if not from JSON-LD
  if (!totalTime) {
    const timeMatch = extractText(
      html,
      /(?:Total|Durée)[^<]*?(\d+)\s*min/i
    );
    if (timeMatch) totalTime = parseInt(timeMatch);
  }

  // Extract tags
  const tagRegex = /data-translation-id="recipe-detail\.tags[^"]*"[^>]*>([^<]+)/gi;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(html)) !== null) {
    tags.push(decodeHtml(tagMatch[1]).trim());
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
    tags,
  };
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { url, groupId } = await req.json();

  if (
    !url ||
    !url.includes("hellofresh.fr/recipes/")
  ) {
    return NextResponse.json(
      { error: "URL HelloFresh invalide" },
      { status: 400 }
    );
  }

  try {
    const html = await fetchPage(url);
    const scraped = parseRecipePage(html);

    // Use CDN URLs directly (publicly accessible, no download needed)
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
        groupId: groupId || null,
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
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Impossible de scraper la recette: ${message}` },
      { status: 500 }
    );
  }
}
