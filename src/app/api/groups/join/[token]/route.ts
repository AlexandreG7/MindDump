import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// POST — rejoindre un groupe via token
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const invite = await prisma.groupInvite.findUnique({
    where: { token: params.token },
    include: { group: true },
  });

  if (!invite) return NextResponse.json({ error: "Invitation invalide" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "Invitation déjà utilisée" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Invitation expirée" }, { status: 410 });

  // Vérifier si déjà membre
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
  });

  if (!existing) {
    await prisma.groupMember.create({
      data: { groupId: invite.groupId, userId: user.id, role: "member" },
    });
  }

  // Marquer l'invitation comme utilisée
  await prisma.groupInvite.update({
    where: { token: params.token },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ groupId: invite.groupId, groupName: invite.group.name });
}

// GET — infos sur l'invitation (sans auth, pour afficher avant connexion)
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const invite = await prisma.groupInvite.findUnique({
    where: { token: params.token },
    include: { group: { include: { owner: { select: { name: true } }, _count: { select: { members: true } } } } },
  });

  if (!invite) return NextResponse.json({ error: "Invitation invalide" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "Invitation déjà utilisée" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Invitation expirée" }, { status: 410 });

  return NextResponse.json({
    groupName: invite.group.name,
    ownerName: invite.group.owner.name,
    memberCount: invite.group._count.members,
    expiresAt: invite.expiresAt,
  });
}
