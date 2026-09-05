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

export function stripHtml(text: string): string {
  return text
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractRecipeId(url: string): string | null {
  const match = url.match(/([0-9a-f]{20,})(?:\?|$)/);
  return match ? match[1] : null;
}

export interface ParsedRecipe {
  title: string;
  description: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: { text: string; image: string | null }[];
  heroImage: string | null;
}

export interface HFStep {
  index: number;
  instructionsMarkdown?: string;
  instructions?: string;
  images?: { link?: string; path?: string }[];
}

export interface HFRecipeAPI {
  name?: string;
  description?: string;
  headline?: string;
  prepTime?: string;
  totalTime?: string;
  imagePath?: string;
  imageLink?: string;
  steps?: HFStep[];
  ingredients?: { id?: string; name?: string }[];
  yields?: {
    yields: number;
    ingredients: { id?: string; amount?: number | null; unit?: string }[];
  }[];
}

export interface EnrichedData {
  description: string | null;
  prepTime: number | null;
  cookTime: number | null;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: { text: string; image: string | null }[];
  heroImage: string | null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getHelloFreshToken(
  clientToken?: string
): Promise<string | null> {
  if (clientToken) return clientToken;
  if (process.env.HELLOFRESH_TOKEN) return process.env.HELLOFRESH_TOKEN;
  if (cachedToken && Date.now() < cachedToken.expiresAt)
    return cachedToken.token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://www.hellofresh.fr/", {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    const auth = data?.props?.pageProps?.ssrPayload?.serverAuth;
    if (!auth?.access_token) return null;
    cachedToken = {
      token: auth.access_token,
      expiresAt: Date.now() + (auth.expires_in || 3600) * 1000 - 60000,
    };
    return cachedToken.token;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function fetchFromHelloFreshAPI(
  recipeId: string,
  clientToken?: string
): Promise<HFRecipeAPI | null> {
  const token = await getHelloFreshToken(clientToken);
  if (!token) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `https://gw.hellofresh.com/api/recipes/${recipeId}?country=FR&locale=fr-FR`;
    const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    return null;
  }
}

export function parseAPIResponse(
  data: HFRecipeAPI,
  targetServings: number
): EnrichedData {
  let heroImage: string | null = null;
  if (data.imagePath)
    heroImage = `https://img.hellofresh.com/q_auto,f_auto,w_1200${data.imagePath}`;
  else if (data.imageLink) heroImage = data.imageLink;

  let totalTime: number | null = null;
  const timeStr = data.prepTime || data.totalTime;
  if (timeStr) {
    const tm = timeStr.match(/PT(\d+)M/);
    if (tm) totalTime = parseInt(tm[1]);
  }

  const steps: { text: string; image: string | null }[] = [];
  if (data.steps) {
    for (const step of [...data.steps].sort((a, b) => a.index - b.index)) {
      const text = stripHtml(
        step.instructionsMarkdown || step.instructions || ""
      );
      let image: string | null = null;
      if (step.images?.[0]) {
        const img = step.images[0];
        image = img.path
          ? `https://img.hellofresh.com/q_auto,f_auto,w_750${img.path}`
          : img.link || null;
      }
      if (text || image) steps.push({ text, image });
    }
  }

  const ingredientNames = new Map<string, string>();
  if (data.ingredients) {
    for (const ing of data.ingredients) {
      if (ing.id && ing.name) ingredientNames.set(ing.id, ing.name);
    }
  }

  const ingredients: { name: string; quantity: string; unit: string }[] = [];
  if (data.yields?.length) {
    const yieldSet =
      data.yields.find((y) => y.yields === targetServings) || data.yields[0];
    for (const yi of yieldSet.ingredients) {
      const name = yi.id ? ingredientNames.get(yi.id) : undefined;
      if (!name) continue;
      ingredients.push({
        name,
        quantity: yi.amount != null ? String(yi.amount) : "",
        unit: yi.unit || "",
      });
    }
  }

  return {
    description: data.headline || data.description || null,
    prepTime: totalTime ? Math.round(totalTime * 0.4) : null,
    cookTime: totalTime ? Math.round(totalTime * 0.6) : null,
    ingredients,
    steps,
    heroImage,
  };
}

export function parseHelloFreshPage(html: string): ParsedRecipe {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1Match ? decodeHtml(h1Match[1]).trim() : "Recette sans titre";

  const descMatch = html.match(
    /data-test-id="recipe-description"[^>]*>([\s\S]*?)<\//i
  );
  const description = descMatch ? decodeHtml(descMatch[1]).trim() : null;

  let heroImage: string | null = null;
  const heroMatch = html.match(
    /(https:\/\/media\.hellofresh\.com\/[^"'\s]*(?:recipes\/image|MAIN)[^"'\s]*\.(?:jpg|jpeg|png|webp))/i
  );
  if (heroMatch) heroImage = heroMatch[1];

  const stepImages: string[] = [];
  const stepImgRegex =
    /(https:\/\/media\.hellofresh\.com\/[^"'\s]*\/step-[^"'\s]*\.(?:jpg|jpeg|png|webp))/gi;
  let m;
  while ((m = stepImgRegex.exec(html)) !== null) {
    if (!stepImages.includes(m[1])) stepImages.push(m[1]);
  }

  let totalTime: number | null = null;
  const timeMatch = html.match(/(\d+)\s*min/i);
  if (timeMatch) totalTime = parseInt(timeMatch[1]);

  let servings = 2;
  const servMatch = html.match(
    /data-test-id="recipe-person-count"[^>]*>(\d+)/i
  );
  if (servMatch) servings = parseInt(servMatch[1]);

  const ingredients: { name: string; quantity: string; unit: string }[] = [];
  const steps: { text: string; image: string | null }[] = [];

  const jsonLdMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      const recipe = Array.isArray(data)
        ? data.find(
            (d: Record<string, unknown>) => d["@type"] === "Recipe"
          )
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
        if (recipe.recipeYield) servings = parseInt(recipe.recipeYield) || 2;
        if (recipe.totalTime) {
          const tm = recipe.totalTime.match(/PT(\d+)M/);
          if (tm) totalTime = parseInt(tm[1]);
        }
      }
    } catch {
      // JSON-LD parse failed
    }
  }

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

export async function fetchHelloFreshPage(url: string): Promise<string> {
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
    if (!res.ok)
      throw new Error(`HelloFresh a retourne une erreur ${res.status}`);
    const html = await res.text();
    if (html.length < 500)
      throw new Error("Page HelloFresh trop courte (probablement bloquee)");
    return html;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timeout: HelloFresh n'a pas repondu en 15s");
    }
    throw err;
  }
}

export async function fetchEnrichedData(
  helloFreshUrl: string,
  targetServings: number,
  clientToken?: string
): Promise<EnrichedData | null> {
  const targetUrl = String(helloFreshUrl).split("?")[0];
  const recipeHFId = extractRecipeId(targetUrl);

  if (recipeHFId) {
    const apiData = await fetchFromHelloFreshAPI(recipeHFId, clientToken);
    if (apiData?.name) return parseAPIResponse(apiData, targetServings);
  }

  try {
    const html = await fetchHelloFreshPage(targetUrl);
    const parsed = parseHelloFreshPage(html);
    return { ...parsed, heroImage: parsed.heroImage };
  } catch (err) {
    return null;
  }
}
