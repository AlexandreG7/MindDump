import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { removeMemberProfile } from "@/lib/profiles";
import { isGroupAdmin } from "@/lib/groupAuth";

// DELETE — retirer un membre
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const group = await prisma.group.findFirst({ where: { id: params.id } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  // Le propriétaire ne peut pas être retiré
  if (params.userId === group.ownerId) {
    return NextResponse.json({ error: "Le propriétaire ne peut pas être retiré" }, { status: 400 });
  }

  const isOwner = group.ownerId === user.id;
  const isSelf = params.userId === user.id;

  // Le propriétaire peut retirer n'importe qui (sauf lui-même, exclu ci-dessus).
  // Tout membre peut se retirer lui-même.
  // Un admin non propriétaire peut retirer un membre simple, mais pas un autre admin.
  if (!isOwner && !isSelf) {
    const requesterIsAdmin = await isGroupAdmin(params.id, user.id, group.ownerId);
    if (!requesterIsAdmin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const targetMembership = await prisma.groupMember.findFirst({
      where: { groupId: params.id, userId: params.userId },
    });
    if (targetMembership?.role === "admin") {
      return NextResponse.json(
        { error: "Un admin ne peut pas retirer un autre admin" },
        { status: 403 }
      );
    }
  }

  await prisma.groupMember.deleteMany({
    where: { groupId: params.id, userId: params.userId },
  });
  await removeMemberProfile(params.id, params.userId);

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
