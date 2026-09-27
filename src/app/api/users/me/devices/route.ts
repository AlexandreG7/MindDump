import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Appareils connectés par l'app mobile (étape 2.2). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const devices = await prisma.mobileDevice.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, platform: true, createdAt: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
  });
  return NextResponse.json(devices);
}
