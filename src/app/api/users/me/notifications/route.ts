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
    select: { notifyEmail: true, notifyReminders: true },
  });
  return NextResponse.json({
    notifyEmail: full?.notifyEmail ?? true,
    notifyReminders: full?.notifyReminders ?? true,
    pushPublicKey: pushPublicKey(),
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const data: { notifyEmail?: boolean; notifyReminders?: boolean } = {};
  if (typeof body?.notifyEmail === "boolean") data.notifyEmail = body.notifyEmail;
  if (typeof body?.notifyReminders === "boolean") data.notifyReminders = body.notifyReminders;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "notifyEmail ou notifyReminders requis" }, { status: 400 });
  }

  const full = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { notifyEmail: true, notifyReminders: true },
  });
  return NextResponse.json(full);
}
