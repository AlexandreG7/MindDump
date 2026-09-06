import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { searchQuitoque } from "@/lib/quitoque";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "5"), 20);

  try {
    const results = await searchQuitoque(q, limit);
    return NextResponse.json({ total: results.length, results });
  } catch {
    return NextResponse.json({ error: "Recherche Quitoque échouée" }, { status: 502 });
  }
}
