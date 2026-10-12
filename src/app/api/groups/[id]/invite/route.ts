import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// POST — générer un lien d'invitation (valide 7 jours)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Vérifier que l'utilisateur est admin ou propriétaire
  const member = await prisma.groupMember.findFirst({
    where: {
      groupId: params.id,
      userId: user.id,
      role: "admin",
    },
  });

  const group = await prisma.group.findFirst({ where: { id: params.id } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  if (!member && group.ownerId !== user.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { email } = await req.json().catch(() => ({ email: null }));

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

  const invite = await prisma.groupInvite.create({
    data: {
      groupId: params.id,
      // 32 caractères aléatoires (ce lien peut aussi ouvrir une inscription, groupInviteSignup.ts).
      token: randomBytes(24).toString("base64url"),
      email: email || null,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const joinUrl = `${baseUrl}/groups/join/${invite.token}`;

  return NextResponse.json({ token: invite.token, joinUrl, expiresAt });
}

// GET — lister les invitations actives
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const group = await prisma.group.findFirst({
    where: {
      id: params.id,
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
  });
  if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  const invites = await prisma.groupInvite.findMany({
    where: { groupId: params.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "asc" },
  });

  return NextResponse.json(invites);
}
