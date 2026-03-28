import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// GET — groupes dont l'utilisateur est propriétaire ou membre
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const [owned, memberships] = await Promise.all([
    prisma.group.findMany({
      where: { ownerId: user.id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            owner: { select: { id: true, name: true, email: true, image: true } },
            members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
            _count: { select: { members: true } },
          },
        },
      },
    }),
  ]);

  // Merge + déduplique (propriétaire peut aussi être membre)
  const memberGroups = memberships.map((m) => m.group).filter(
    (g) => !owned.find((o) => o.id === g.id)
  );

  return NextResponse.json({ owned, member: memberGroups });
}

// POST — créer un groupe
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      ownerId: user.id,
      // Le propriétaire est automatiquement membre admin
      members: {
        create: { userId: user.id, role: "admin" },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json(group, { status: 201 });
}
