import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const results: Record<string, unknown> = {};

  // Test 1: Can we reach gw.hellofresh.com?
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://gw.hellofresh.com/api/recipes/search?country=FR&locale=fr-FR&q=poulet&limit=1", {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${body.token || "invalid"}`,
        Accept: "application/json",
      },
    });
    clearTimeout(timeout);
    const text = await res.text();
    results.api = { status: res.status, bodyPreview: text.substring(0, 200) };
  } catch (err) {
    results.api = { error: err instanceof Error ? err.message : String(err) };
  }

  // Test 2: Can we reach hellofresh.fr?
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://www.hellofresh.fr/", {
      signal: controller.signal,
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timeout);
    results.homepage = { status: res.status, length: (await res.text()).length };
  } catch (err) {
    results.homepage = { error: err instanceof Error ? err.message : String(err) };
  }

  // Test 3: env var
  results.hasEnvToken = !!process.env.HELLOFRESH_TOKEN;
  results.envTokenPrefix = process.env.HELLOFRESH_TOKEN?.substring(0, 20) || "not set";

  return NextResponse.json(results);
}
