import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findWallDevice } from "@/lib/wall";

// Cocher un article d'une liste de courses du groupe depuis l'écran mural.
export async function POST(req: NextRequest, { params }: { params: { token: string; id: string } }) {
  const device = await findWallDevice(params.token);
  if (!device) return NextResponse.json({ error: "Écran inconnu ou révoqué" }, { status: 404 });

  const { checked } = await req.json().catch(() => ({}));
  if (typeof checked !== "boolean") return NextResponse.json({ error: "checked requis" }, { status: 400 });

  const { count } = await prisma.shoppingItem.updateMany({
    where: { id: params.id, list: { groupId: device.groupId } },
    data: { checked },
  });
  if (count === 0) return NextResponse.json({ error: "Article introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
