import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// DELETE — retirer un membre
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const group = await prisma.group.findFirst({ where: { id: params.id } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  // Le propriétaire peut retirer n'importe qui, un membre peut se retirer lui-même
  const isOwner = group.ownerId === user.id;
  const isSelf = params.userId === user.id;

  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Le propriétaire ne peut pas être retiré
  if (params.userId === group.ownerId) {
    return NextResponse.json({ error: "Le propriétaire ne peut pas être retiré" }, { status: 400 });
  }

  await prisma.groupMember.deleteMany({
    where: { groupId: params.id, userId: params.userId },
  });

  return NextResponse.json({ ok: true });
}

// PATCH — changer le rôle d'un membre (admin seulement)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const group = await prisma.group.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!group) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { role } = await req.json();
  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const updated = await prisma.groupMember.update({
    where: { groupId_userId: { groupId: params.id, userId: params.userId } },
    data: { role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(updated);
}
