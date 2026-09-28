import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { isGroupAdmin } from "@/lib/profiles";
import { generateWallToken } from "@/lib/wall";

const forbidden = () =>
  NextResponse.json({ error: "Réservé aux admins du groupe" }, { status: 403 });

// GET — écrans muraux du groupe (admins)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!(await isGroupAdmin(params.id, user.id))) return forbidden();

  const devices = await prisma.wallDevice.findMany({
    where: { groupId: params.id },
    select: { id: true, name: true, createdAt: true, lastSeenAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(devices);
}

// POST — nouvel écran : le lien secret n'est renvoyé qu'ici, une seule fois.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!(await isGroupAdmin(params.id, user.id))) return forbidden();

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "Écran de la cuisine";
  if ((await prisma.wallDevice.count({ where: { groupId: params.id } })) >= 10) {
    return NextResponse.json({ error: "10 écrans au plus par groupe" }, { status: 400 });
  }

  const { token, tokenHash } = generateWallToken();
  const device = await prisma.wallDevice.create({
    data: { name, tokenHash, groupId: params.id, createdById: user.id },
    select: { id: true, name: true, createdAt: true, lastSeenAt: true },
  });
  return NextResponse.json({ ...device, path: `/wall/${token}` }, { status: 201 });
}
