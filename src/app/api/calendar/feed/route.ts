import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { randomBytes } from "crypto";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { calendarToken: true },
  });

  return NextResponse.json({ token: dbUser?.calendarToken ?? null });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const token = randomBytes(32).toString("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: { calendarToken: token },
  });

  return NextResponse.json({ token });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.user.update({
    where: { id: user.id },
    data: { calendarToken: null },
  });

  return NextResponse.json({ success: true });
}
