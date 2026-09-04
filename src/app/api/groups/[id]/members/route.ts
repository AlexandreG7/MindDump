import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const group = await prisma.group.findFirst({ where: { id: params.id } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  const isAdmin = group.ownerId === user.id || !!(await prisma.groupMember.findFirst({
    where: { groupId: params.id, userId: user.id, role: "admin" },
  }));
  if (!isAdmin) {
    return NextResponse.json({ error: "Seuls les admins peuvent ajouter des membres" }, { status: 403 });
  }

  const { publicId } = await req.json();
  if (!publicId) {
    return NextResponse.json({ error: "publicId requis" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { publicId: publicId.replace(/^#/, "") },
    select: { id: true, name: true, publicId: true, image: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: targetUser.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Déjà membre du groupe" }, { status: 409 });
  }

  const member = await prisma.groupMember.create({
    data: {
      groupId: params.id,
      userId: targetUser.id,
      role: "member",
    },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return NextResponse.json(member, { status: 201 });
}
