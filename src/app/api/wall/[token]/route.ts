import { NextRequest, NextResponse } from "next/server";
import { buildWallSnapshot, findWallDevice, parseWallRange } from "@/lib/wall";

// Tableau de l'écran mural : pas de session, le jeton du lien fait foi.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const device = await findWallDevice(params.token);
  if (!device) return NextResponse.json({ error: "Écran inconnu ou révoqué" }, { status: 404 });

  const { from, to } = parseWallRange(req.nextUrl.searchParams.get("from"), req.nextUrl.searchParams.get("to"));
  const snapshot = await buildWallSnapshot(device, from, to);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
