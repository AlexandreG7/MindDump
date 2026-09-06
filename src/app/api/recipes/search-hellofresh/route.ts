import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "5"), 20);

  const proxyUrl = process.env.HELLOFRESH_PROXY_URL;
  const proxySecret = process.env.HELLOFRESH_PROXY_SECRET;
  if (!proxyUrl || !proxySecret) {
    return NextResponse.json({ error: "Proxy not configured" }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(
      `${proxyUrl}/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${proxySecret}`,
          Accept: "application/json",
        },
      }
    );
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json({ error: `Proxy returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ error: "Search request failed" }, { status: 502 });
  }
}
