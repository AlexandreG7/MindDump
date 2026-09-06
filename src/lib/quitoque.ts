import { stripHtml, type ParsedRecipe } from "./hellofresh";

interface QuitoqueJsonLdRecipe {
  "@type"?: string;
  name?: string;
  description?: string;
  image?: string | string[];
  prepTime?: string;
  totalTime?: string;
  recipeYield?: string;
  recipeIngredient?: string[];
  recipeInstructions?: (string | { "@type"?: string; name?: string; text?: string })[];
}

function parseIsoDuration(iso: string): number | null {
  const h = iso.match(/(\d+)H/);
  const m = iso.match(/(\d+)M/);
  let minutes = 0;
  if (h) minutes += parseInt(h[1]) * 60;
  if (m) minutes += parseInt(m[1]);
  return minutes > 0 ? minutes : null;
}

function parseIngredientLine(line: string): { name: string; quantity: string; unit: string } {
  const cleaned = line.trim();

  // Patterns: "150 ml lait de coco", "1 oignon jaune", "0.5 citron jaune (Bio)", "1 à 3 cm gingembre", "1 gousse d'ail"
  const match = cleaned.match(
    /^([\d.,/]+(?:\s*[àa]\s*[\d.,/]+)?)\s+(ml|g|kg|cl|l|cm|gousse[s]?|tranche[s]?|feuille[s]?|brin[s]?|pincée[s]?|cuillère[s]?\s*(?:à\s*(?:soupe|café))?|c\.?\s*à\s*[sc]\.?|cas|cac)\s+(.+)$/i
  );
  if (match) {
    let name = match[3].replace(/\s*\(Bio\)\s*/gi, "").trim();
    // "gousse d'ail" → unit="gousse", name="ail" (not "d'ail")
    name = name.replace(/^d[''’]\s*/i, "");
    return { quantity: match[1], unit: match[2], name };
  }

  // Pattern: "1 oignon jaune" (no unit, just count + name)
  const countMatch = cleaned.match(/^([\d.,/]+(?:\s*[àa]\s*[\d.,/]+)?)\s+(.+)$/);
  if (countMatch) {
    return { quantity: countMatch[1], unit: "", name: countMatch[2].replace(/\s*\(Bio\)\s*/gi, "").trim() };
  }

  return { name: cleaned.replace(/\s*\(Bio\)\s*/gi, "").trim(), quantity: "1", unit: "" };
}

export function parseQuitoqueJsonLd(html: string): ParsedRecipe | null {
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      let data = JSON.parse(match[1]);
      if (Array.isArray(data)) data = data.find((d: Record<string, unknown>) => d["@type"] === "Recipe");
      if (!data || data["@type"] !== "Recipe") continue;

      const recipe = data as QuitoqueJsonLdRecipe;

      let heroImage: string | null = null;
      if (recipe.image) {
        heroImage = Array.isArray(recipe.image) ? recipe.image[0] : recipe.image;
      }

      const prepTime = recipe.prepTime ? parseIsoDuration(recipe.prepTime) : null;
      const totalTime = recipe.totalTime ? parseIsoDuration(recipe.totalTime) : null;

      const ingredients = (recipe.recipeIngredient || []).map(parseIngredientLine);

      const steps: { text: string; image: string | null }[] = [];
      if (recipe.recipeInstructions) {
        for (const s of recipe.recipeInstructions) {
          const text = typeof s === "string" ? s : s?.text || "";
          if (text) steps.push({ text: stripHtml(text), image: null });
        }
      }

      return {
        title: recipe.name || "Recette Quitoque",
        description: recipe.description || null,
        prepTime: prepTime || (totalTime ? Math.round(totalTime * 0.4) : null),
        cookTime: totalTime && prepTime ? totalTime - prepTime : (totalTime ? Math.round(totalTime * 0.6) : null),
        servings: recipe.recipeYield ? parseInt(recipe.recipeYield) || 2 : 2,
        ingredients,
        steps,
        heroImage,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function parseQuitoqueHtml(html: string): ParsedRecipe {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1Match ? stripHtml(h1Match[1]).trim() : "Recette Quitoque";

  const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  const description = descMatch ? descMatch[1].trim() : null;

  let heroImage: string | null = null;
  const ogImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
  if (ogImg) heroImage = ogImg[1];

  let totalTime: number | null = null;
  const timeMatch = html.match(/recipe-duration[\s\S]*?(\d+)\s*min/i);
  if (timeMatch) totalTime = parseInt(timeMatch[1]);

  const ingredients: { name: string; quantity: string; unit: string }[] = [];
  const ingRegex = /<li[^>]*class="[^"]*mb-0[^"]*pb-3[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let ingMatch;
  while ((ingMatch = ingRegex.exec(html)) !== null) {
    const text = stripHtml(ingMatch[1]).replace(/\s+/g, " ").trim();
    if (text) ingredients.push(parseIngredientLine(text));
  }

  const steps: { text: string; image: string | null }[] = [];
  const stepBlockRegex = /<(?:div|section)[^>]*class="[^"]*(?:toggle|step-instructions)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/gi;
  let stepMatch;
  while ((stepMatch = stepBlockRegex.exec(html)) !== null) {
    const block = stepMatch[1];
    const liItems: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(block)) !== null) {
      const text = stripHtml(liMatch[1]).trim();
      if (text && text.length > 5) liItems.push(text);
    }
    if (liItems.length > 0) {
      steps.push({ text: liItems.join(" "), image: null });
    }
  }

  return {
    title,
    description,
    prepTime: totalTime ? Math.round(totalTime * 0.4) : null,
    cookTime: totalTime ? Math.round(totalTime * 0.6) : null,
    servings: 2,
    ingredients,
    steps,
    heroImage,
  };
}

export async function fetchQuitoquePage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    clearTimeout(timeout);
    if (!res.ok)
      throw new Error(`Quitoque a retourné une erreur ${res.status}`);
    const html = await res.text();
    if (html.length < 500)
      throw new Error("Page Quitoque trop courte (probablement bloquée)");
    return html;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timeout: Quitoque n'a pas répondu en 15s");
    }
    throw err;
  }
}

export async function parseQuitoqueRecipe(url: string): Promise<ParsedRecipe> {
  const html = await fetchQuitoquePage(url);
  const fromJsonLd = parseQuitoqueJsonLd(html);
  if (fromJsonLd && fromJsonLd.ingredients.length > 0) return fromJsonLd;
  return parseQuitoqueHtml(html);
}

export interface QuitoqueSearchResult {
  slug: string;
  title: string;
  url: string;
  image: string | null;
  duration: string | null;
}

export async function searchQuitoque(query: string, limit: number = 10): Promise<QuitoqueSearchResult[]> {
  const searchUrl = `https://www.quitoque.fr/recettes?q=${encodeURIComponent(query)}`;
  const html = await fetchQuitoquePage(searchUrl);

  const results: QuitoqueSearchResult[] = [];
  const cardRegex = /<div[^>]*class="card product recipe\s*"[^>]*>([\s\S]*?)(?=<div[^>]*class="card product |$)/gi;
  let cardMatch;
  while ((cardMatch = cardRegex.exec(html)) !== null && results.length < limit) {
    const card = cardMatch[1];

    const hrefMatch = card.match(/href="(\/recettes\/([a-z0-9-]+))"/i);
    if (!hrefMatch || hrefMatch[2] === "recettes-de-saison") continue;

    const slug = hrefMatch[2];
    const url = `https://www.quitoque.fr${hrefMatch[1]}`;

    const titleMatch = card.match(/class="[^"]*card__content_title[^"]*"[\s\S]*?<a[^>]*>([^<]+)</i)
      || card.match(/alt="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    const imgMatch = card.match(/data-src="([^"]+)"/i);
    const image = imgMatch ? imgMatch[1] : null;

    const timeMatch = card.match(/(\d+)\s*min/);
    const duration = timeMatch ? `${timeMatch[1]} min` : null;

    results.push({ slug, title, url, image, duration });
  }

  return results;
}
