import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const entries = await prisma.kidDayEntry.findMany({
    where: {
      userId: user.id,
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
  });

  const parsed = entries.map((e) => ({
    ...e,
    activities: JSON.parse(e.activities || "[]"),
  }));

  return NextResponse.json(parsed);
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { date, ...fields } = body;

  if (!date || typeof date !== "string") {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }

  if (Array.isArray(fields.activities)) {
    fields.activities = JSON.stringify(fields.activities);
  }

  const entry = await prisma.kidDayEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, ...fields },
    update: fields,
  });

  return NextResponse.json({
    ...entry,
    activities: JSON.parse(entry.activities || "[]"),
  });
}
