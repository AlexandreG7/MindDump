import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { pushPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Préférences de rappel ; pushPublicKey est null si le push n'est pas configuré. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notifyEmail: true },
  });
  return NextResponse.json({
    notifyEmail: full?.notifyEmail ?? true,
    pushPublicKey: pushPublicKey(),
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  if (typeof body?.notifyEmail !== "boolean") {
    return NextResponse.json({ error: "notifyEmail requis" }, { status: 400 });
  }

  const full = await prisma.user.update({
    where: { id: user.id },
    data: { notifyEmail: body.notifyEmail },
    select: { notifyEmail: true },
  });
  return NextResponse.json(full);
}
