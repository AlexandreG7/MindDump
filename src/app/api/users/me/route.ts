import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { generateUniquePublicId } from "@/lib/publicId";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, publicId: true, name: true, email: true, image: true },
  });

  if (full && !full.publicId) {
    const publicId = await generateUniquePublicId();
    full = await prisma.user.update({
      where: { id: user.id },
      data: { publicId },
      select: { id: true, publicId: true, name: true, email: true, image: true },
    });
  }

  return NextResponse.json(full);
}
