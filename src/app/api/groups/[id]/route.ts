import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// GET — détail d'un groupe
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const group = await prisma.group.findFirst({
    where: {
      id: params.id,
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      invites: { where: { usedAt: null, expiresAt: { gt: new Date() } } },
    },
  });

  if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  return NextResponse.json(group);
}

// PATCH — renommer (propriétaire seulement)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();

  const group = await prisma.group.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable ou non autorisé" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name?.trim()) data.name = body.name.trim();
  if (typeof body.shareTodos === "boolean") data.shareTodos = body.shareTodos;
  if (typeof body.shareCalendar === "boolean") data.shareCalendar = body.shareCalendar;
  if (typeof body.shareLists === "boolean") data.shareLists = body.shareLists;
  if (typeof body.shareRecipes === "boolean") data.shareRecipes = body.shareRecipes;
  if (typeof body.isDefault === "boolean") data.isDefault = body.isDefault;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const updated = await prisma.group.update({
    where: { id: params.id },
    data,
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE — supprimer le groupe (propriétaire seulement)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const group = await prisma.group.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable ou non autorisé" }, { status: 404 });

  await prisma.group.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
