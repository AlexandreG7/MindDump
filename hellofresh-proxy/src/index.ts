interface Env {
  PROXY_SECRET: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const res = await fetch("https://www.hellofresh.fr/", {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
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
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Auth check
    const authHeader = request.headers.get("Authorization") || "";
    const secret = authHeader.replace("Bearer ", "");
    if (secret !== env.PROXY_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = new URL(request.url);

    // GET /api/recipes/:id?servings=4
    if (url.pathname.startsWith("/api/recipes/")) {
      const recipeId = url.pathname.split("/api/recipes/")[1];
      if (!recipeId || !/^[0-9a-f]{20,}$/.test(recipeId)) {
        return json({ error: "Invalid recipe ID" }, 400);
      }

      const token = await getToken();
      if (!token) return json({ error: "Cannot get HelloFresh token" }, 502);

      const apiRes = await fetch(
        `https://gw.hellofresh.com/api/recipes/${recipeId}?country=FR&locale=fr-FR`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Accept-Language": "fr-FR,fr;q=0.9",
            "User-Agent": UA,
          },
        }
      );

      if (!apiRes.ok) {
        return json({ error: `HelloFresh API returned ${apiRes.status}` }, apiRes.status);
      }

      const data = await apiRes.json();
      return json(data);
    }

    // GET /api/search?q=...&limit=5
    if (url.pathname === "/api/search") {
      const q = url.searchParams.get("q");
      if (!q) return json({ error: "Missing query parameter 'q'" }, 400);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "5"), 20);

      const token = await getToken();
      if (!token) return json({ error: "Cannot get HelloFresh token" }, 502);

      const searchUrl = `https://gw.hellofresh.com/api/recipes/search?q=${encodeURIComponent(q)}&country=FR&locale=fr-FR&limit=${limit}`;
      const apiRes = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "User-Agent": UA,
        },
      });

      if (!apiRes.ok) {
        return json({ error: `HelloFresh search returned ${apiRes.status}` }, apiRes.status);
      }

      const data: any = await apiRes.json();
      const results = (data.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        headline: item.headline,
        prepTime: item.prepTime,
        imagePath: item.imagePath
          ? `https://img.hellofresh.com/q_auto,f_auto,w_600/hellofresh_s3${item.imagePath}`
          : null,
        url: `https://www.hellofresh.fr/recipes/${item.slug}-${item.id}`,
      }));

      return json({ total: data.total || 0, results });
    }

    // GET /health
    if (url.pathname === "/health") {
      return json({ status: "ok", service: "hellofresh-proxy" });
    }

    return json({ error: "Not found" }, 404);
  },
};
