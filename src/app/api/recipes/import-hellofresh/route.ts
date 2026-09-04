import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]*>/g, "");
}

interface ParsedRecipe {
  title: string;
  description: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: { text: string; image: string | null }[];
  heroImage: string | null;
}

function parseHelloFreshPage(html: string): ParsedRecipe {
  // Title from <h1>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1Match ? decodeHtml(h1Match[1]).trim() : "Recette sans titre";

  // Description from subtitle
  const descMatch = html.match(
    /data-test-id="recipe-description"[^>]*>([\s\S]*?)<\//i
  );
  const description = descMatch ? decodeHtml(descMatch[1]).trim() : null;

  // Hero image — look for the main recipe image on the CDN
  let heroImage: string | null = null;
  const heroMatch = html.match(
    /(https:\/\/media\.hellofresh\.com\/[^"'\s]*(?:recipes\/image|MAIN)[^"'\s]*\.(?:jpg|jpeg|png|webp))/i
  );
  if (heroMatch) heroImage = heroMatch[1];

  // Step images
  const stepImages: string[] = [];
  const stepImgRegex =
    /(https:\/\/media\.hellofresh\.com\/[^"'\s]*\/step-[^"'\s]*\.(?:jpg|jpeg|png|webp))/gi;
  let m;
  while ((m = stepImgRegex.exec(html)) !== null) {
    if (!stepImages.includes(m[1])) stepImages.push(m[1]);
  }

  // Time
  let totalTime: number | null = null;
  const timeMatch = html.match(/(\d+)\s*min/i);
  if (timeMatch) totalTime = parseInt(timeMatch[1]);

  // Servings
  let servings = 2;
  const servMatch = html.match(/data-test-id="recipe-person-count"[^>]*>(\d+)/i);
  if (servMatch) servings = parseInt(servMatch[1]);

  // Try JSON-LD
  const ingredients: { name: string; quantity: string; unit: string }[] = [];
  const steps: { text: string; image: string | null }[] = [];

  const jsonLdMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      const recipe = Array.isArray(data)
        ? data.find((d: Record<string, unknown>) => d["@type"] === "Recipe")
        : data["@type"] === "Recipe"
        ? data
        : null;
      if (recipe) {
        if (recipe.recipeIngredient) {
          for (const ing of recipe.recipeIngredient) {
            const parts = String(ing).match(
              /^([\d.,/½¼¾⅓⅔]+)?\s*(\S+)?\s+(.+)$/
            );
            if (parts) {
              ingredients.push({
                quantity: parts[1] || "1",
                unit: parts[2] || "",
                name: parts[3],
              });
            } else {
              ingredients.push({ name: String(ing), quantity: "1", unit: "" });
            }
          }
        }
        if (recipe.recipeInstructions) {
          for (let i = 0; i < recipe.recipeInstructions.length; i++) {
            const s = recipe.recipeInstructions[i];
            const text = typeof s === "string" ? s : s?.text || "";
            if (text) {
              steps.push({
                text,
                image: i < stepImages.length ? stepImages[i] : null,
              });
            }
          }
        }
        if (!heroImage && recipe.image) {
          heroImage = Array.isArray(recipe.image)
            ? recipe.image[0]
            : recipe.image;
        }
        if (recipe.recipeYield) {
          servings = parseInt(recipe.recipeYield) || 2;
        }
        if (recipe.totalTime) {
          const tm = recipe.totalTime.match(/PT(\d+)M/);
          if (tm) totalTime = parseInt(tm[1]);
        }
      }
    } catch {
      // JSON-LD parse failed
    }
  }

  // HTML fallback for ingredients if JSON-LD didn't provide them
  if (ingredients.length === 0) {
    const ingBlockRegex =
      /data-test-id="ingredient-item-shipped"[^>]*>([\s\S]*?)<\/div>/gi;
    let ingM;
    while ((ingM = ingBlockRegex.exec(html)) !== null) {
      const text = decodeHtml(ingM[1]).trim();
      if (text) {
        const parts = text.match(/^([\d.,/½¼¾⅓⅔]+)\s*(\S+)\s+(.+)$/);
        if (parts) {
          ingredients.push({
            quantity: parts[1],
            unit: parts[2],
            name: parts[3],
          });
        } else {
          ingredients.push({ name: text, quantity: "1", unit: "" });
        }
      }
    }
  }

  // HTML fallback for steps
  if (steps.length === 0) {
    const stepBlockRegex =
      /data-test-id="instruction-step"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
    let stepM;
    let idx = 0;
    while ((stepM = stepBlockRegex.exec(html)) !== null) {
      const text = decodeHtml(stepM[1]).trim();
      if (text) {
        steps.push({
          text,
          image: idx < stepImages.length ? stepImages[idx] : null,
        });
        idx++;
      }
    }
  }

  // If still no steps, assign step images as empty-text steps
  if (steps.length === 0 && stepImages.length > 0) {
    for (const img of stepImages) {
      steps.push({ text: "", image: img });
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

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let html: string;
    try {
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          Connection: "keep-alive",
        },
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return NextResponse.json(
          { error: `HelloFresh a retourne une erreur ${res.status}` },
          { status: 502 }
        );
      }
      html = await res.text();
    } catch (fetchErr) {
      clearTimeout(timeout);
      const msg =
        fetchErr instanceof Error && fetchErr.name === "AbortError"
          ? "Timeout: HelloFresh n'a pas repondu en 15s"
          : `Impossible de contacter HelloFresh: ${fetchErr instanceof Error ? fetchErr.message : "erreur reseau"}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (html.length < 500) {
      return NextResponse.json(
        { error: "La page HelloFresh retournee est trop courte (probablement bloquee)" },
        { status: 502 }
      );
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
      {
        error: `Erreur serveur: ${e instanceof Error ? e.message : "inconnue"}`,
      },
      { status: 500 }
    );
  }
}
