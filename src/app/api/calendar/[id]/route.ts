import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { buildItemAccessWhere } from "@/lib/groupAuth";
import { isEventColor, isRecurrence } from "@/lib/recurrence";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();

  const access = await buildItemAccessWhere(user.id);
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: params.id, ...access },
  });
  if (!existing) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  // Déplacer l'événement ou changer son rappel ré-arme le rappel.
  const rearm =
    (body.date !== undefined &&
      new Date(body.date).getTime() !== existing.date.getTime()) ||
    (body.recurrence !== undefined &&
      (isRecurrence(body.recurrence) ? body.recurrence : null) !== existing.recurrence) ||
    (body.notifyBefore !== undefined &&
      (body.notifyBefore || null) !== existing.notifyBefore);

  const event = await prisma.calendarEvent.updateMany({
    where: { id: params.id, ...access },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.date !== undefined && { date: new Date(body.date) }),
      ...(body.endDate !== undefined && {
        endDate: body.endDate ? new Date(body.endDate) : null,
      }),
      ...(body.allDay !== undefined && { allDay: body.allDay }),
      ...(body.recurrence !== undefined && {
        recurrence: isRecurrence(body.recurrence) ? body.recurrence : null,
      }),
      ...(body.color !== undefined && {
        color: isEventColor(body.color) ? body.color : null,
      }),
      ...(body.notifyBefore !== undefined && { notifyBefore: body.notifyBefore }),
      ...(rearm && { notified: false, notifiedOccurrence: null }),
    },
  });

  if (event.count === 0) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.calendarEvent.deleteMany({
    where: { id: params.id, ...(await buildItemAccessWhere(user.id)) },
  });

  return NextResponse.json({ success: true });
}
