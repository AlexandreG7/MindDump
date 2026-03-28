import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { randomBytes } from "crypto";

// GET — lister les API keys de l'utilisateur
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      // Ne renvoyer que les 8 derniers caractères de la clé
      key: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Masquer la clé sauf les 8 derniers caractères
  const masked = keys.map((k) => ({
    ...k,
    key: "mdk_..." + k.key.slice(-8),
  }));

  return NextResponse.json(masked);
}

// POST — créer une nouvelle API key
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const name = body.name || "MCP";

  // Générer une clé unique préfixée
  const rawKey = randomBytes(32).toString("hex");
  const key = `mdk_${rawKey}`;

  const apiKey = await prisma.apiKey.create({
    data: {
      key,
      name,
      userId: user.id,
    },
  });

  // Renvoyer la clé complète UNE SEULE FOIS (à la création)
  return NextResponse.json(
    {
      id: apiKey.id,
      key: apiKey.key,
      name: apiKey.name,
      createdAt: apiKey.createdAt,
      warning: "Sauvegardez cette clé, elle ne sera plus affichée en entier.",
    },
    { status: 201 }
  );
}

// DELETE — supprimer une API key
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  await prisma.apiKey.deleteMany({
    where: { id, userId: user.id },
  });

  return NextResponse.json({ success: true });
}
