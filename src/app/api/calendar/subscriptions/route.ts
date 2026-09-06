import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const subs = await prisma.calendarSubscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(subs);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const url = (body.url || "").trim().replace(/^webcal:\/\//, "https://");
  const name = (body.name || "").trim();

  if (!url || !name) {
    return NextResponse.json({ error: "URL et nom requis" }, { status: 400 });
  }

  const sub = await prisma.calendarSubscription.create({
    data: {
      name,
      url,
      color: body.color || "#3b82f6",
      userId: user.id,
    },
  });

  return NextResponse.json(sub, { status: 201 });
}
