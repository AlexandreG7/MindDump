import { type EnrichedData } from "./hellofresh";

export function isJowUrl(url: string): boolean {
  return /jow\.fr\/(en\/)?recipes\//.test(url);
}

export function extractJowSlugId(url: string): string | null {
  const match = url.match(/jow\.fr\/(?:en\/)?recipes\/[^?#]+-([a-z0-9]{16,})(?:[?#]|$)/i);
  return match ? match[1] : null;
}

interface JowConstituent {
  id: string;
  name: string;
  isOptional: boolean;
  quantityPerCover: number;
  unit?: {
    abbreviations?: { label: string; minAmount: number; maxAmount?: number; divisor: number }[];
  };
  imageUrl?: string;
}

interface JowDirection {
  label: string;
}

interface JowNextDataRecipe {
  title: string;
  description?: string;
  imageUrl?: string;
  imageUrlHD?: string;
  constituents?: JowConstituent[];
  directions?: JowDirection[];
  preparationTime?: number;
  cookingTime?: number;
  coversCount?: number;
}

function formatQuantity(constituent: JowConstituent, covers: number): { quantity: string; unit: string } {
  const totalQty = constituent.quantityPerCover * covers;
  const abbreviations = constituent.unit?.abbreviations;
  if (!abbreviations?.length) {
    return { quantity: totalQty ? String(Math.round(totalQty * 10) / 10) : "", unit: "" };
  }

  const abbr = abbreviations.find(
    (a) => totalQty >= a.minAmount && (a.maxAmount == null || totalQty < a.maxAmount)
  ) || abbreviations[abbreviations.length - 1];

  const displayQty = totalQty * (abbr.divisor || 1);
  const rounded = Math.round(displayQty * 10) / 10;

  return {
    quantity: rounded ? String(rounded) : "",
    unit: abbr.label?.trim() || "",
  };
}

function parseNextDataRecipe(html: string): JowNextDataRecipe | null {
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    return data?.props?.pageProps?.recipe || null;
  } catch {
    return null;
  }
}

interface JsonLdRecipe {
  name?: string;
  description?: string;
  image?: string | string[];
  recipeIngredient?: string[];
  recipeInstructions?: { text?: string }[] | string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | string[];
}

function parseJsonLd(html: string): JsonLdRecipe | null {
  const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    if (data["@type"] === "Recipe") return data;
    if (Array.isArray(data)) return data.find((d: Record<string, unknown>) => d["@type"] === "Recipe") || null;
    return null;
  } catch {
    return null;
  }
}

function parseIsoDuration(iso: string): number | null {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  return (parseInt(m[1] || "0") * 60) + parseInt(m[2] || "0") || null;
}

function parseIngredientString(s: string): { name: string; quantity: string; unit: string } {
  const match = s.match(/^([\d.,/½¼¾⅓⅔]+)\s*(\S+)\s+(.+)$/);
  if (match) return { quantity: match[1], unit: match[2], name: match[3] };
  return { name: s, quantity: "", unit: "" };
}

export async function fetchJowPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Jow a retourné une erreur ${res.status}`);
    const html = await res.text();
    if (html.length < 500) throw new Error("Page Jow trop courte");
    return html;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timeout: Jow n'a pas répondu en 15s");
    }
    throw err;
  }
}

export function parseJowRecipe(html: string, targetServings?: number): EnrichedData & { title: string; servings: number } {
  const nextData = parseNextDataRecipe(html);

  if (nextData) {
    const covers = targetServings || nextData.coversCount || 4;
    const ingredients = (nextData.constituents || []).map((c) => {
      const { quantity, unit } = formatQuantity(c, covers);
      return { name: c.name, quantity, unit };
    });

    const steps = (nextData.directions || []).map((d) => ({
      text: d.label,
      image: null as string | null,
    }));

    const heroImage = nextData.imageUrlHD || nextData.imageUrl || null;

    return {
      title: nextData.title || "Recette Jow",
      description: nextData.description || null,
      prepTime: nextData.preparationTime || null,
      cookTime: nextData.cookingTime || null,
      servings: covers,
      ingredients,
      steps,
      heroImage,
    };
  }

  // Fallback: JSON-LD
  const jsonLd = parseJsonLd(html);
  if (!jsonLd) throw new Error("Impossible de parser la page Jow");

  const ingredients = (jsonLd.recipeIngredient || []).map(parseIngredientString);
  const steps = (jsonLd.recipeInstructions || []).map((s) => ({
    text: typeof s === "string" ? s : s?.text || "",
    image: null as string | null,
  })).filter((s) => s.text);

  let heroImage: string | null = null;
  if (jsonLd.image) {
    heroImage = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
  }

  let prepTime: number | null = null;
  let cookTime: number | null = null;
  if (jsonLd.prepTime) prepTime = parseIsoDuration(jsonLd.prepTime);
  if (jsonLd.cookTime) cookTime = parseIsoDuration(jsonLd.cookTime);

  const servingsStr = Array.isArray(jsonLd.recipeYield) ? jsonLd.recipeYield[0] : jsonLd.recipeYield;
  const servings = targetServings || parseInt(servingsStr || "4") || 4;

  return {
    title: jsonLd.name || "Recette Jow",
    description: jsonLd.description || null,
    prepTime,
    cookTime,
    servings,
    ingredients,
    steps,
    heroImage,
  };
}

export async function fetchJowRecipe(
  jowUrl: string,
  targetServings?: number
): Promise<(EnrichedData & { title: string; servings: number }) | null> {
  try {
    const html = await fetchJowPage(jowUrl);
    return parseJowRecipe(html, targetServings);
  } catch {
    return null;
  }
}
