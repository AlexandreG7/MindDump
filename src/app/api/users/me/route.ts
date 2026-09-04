import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, publicId: true, name: true, email: true, image: true },
  });

  return NextResponse.json(full);
}
