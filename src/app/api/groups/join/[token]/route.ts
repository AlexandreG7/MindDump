import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";

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
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Route publique qui confirme l'existence d'un jeton : limite par adresse IP.
  if (!rateLimit(`group-join-info:${clientIp(req.headers)}`, 60, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans quelques minutes." }, { status: 429 });
  }
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
    // Ce lien permet-il aussi de créer un compte ? (src/lib/groupInviteSignup.ts : une seule
    // inscription par lien, adresse imposée s'il est nominatif.)
    signupAllowed: !invite.signupClaimedAt,
    inviteEmail: invite.email?.trim().toLowerCase() || null,
  });
}
