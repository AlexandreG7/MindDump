import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const q = new URL(req.url).searchParams.get("q")?.replace(/^#/, "").trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ error: "Recherche trop courte" }, { status: 400 });
  }

  const found = await prisma.user.findUnique({
    where: { publicId: q },
    select: { id: true, publicId: true, name: true, image: true },
  });

  if (!found || found.id === user.id) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: found });
}
