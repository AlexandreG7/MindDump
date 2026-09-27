import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

/**
 * Révoque (supprime) un appareil : sa session tombe à la requête suivante
 * (callback jwt).
 * `current` désigne l'appareil de la session en cours (déconnexion dans l'app) ;
 * sur le web, il n'y en a pas et rien n'est fait.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let deviceId = params.id;
  if (deviceId === "current") {
    const token = await getToken({ req });
    if (typeof token?.deviceId !== "string") return NextResponse.json({ ok: true });
    deviceId = token.deviceId;
  }

  await prisma.mobileDevice.deleteMany({ where: { id: deviceId, userId: user.id } });
  return NextResponse.json({ ok: true });
}
