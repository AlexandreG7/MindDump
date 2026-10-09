import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { buildItemAccessWhere } from "@/lib/groupAuth";
import { readDueDate, readEventDate, readNotifyBefore } from "@/lib/dateInput";
import { isEventColor, isRecurrence } from "@/lib/recurrence";
import { sanitizeAssigneeIds } from "@/lib/profiles";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();

  // Validation avant tout accès base : une saisie invalide n'écrase rien.
  const date = body.date !== undefined ? readEventDate(body.date) : null;
  if (date && !date.ok) return NextResponse.json({ error: date.error }, { status: 400 });
  const endDate = body.endDate !== undefined ? readDueDate(body.endDate) : null;
  if (endDate && !endDate.ok) {
    return NextResponse.json({ error: endDate.error.replace("Échéance", "Fin") }, { status: 400 });
  }
  const notify = body.notifyBefore !== undefined ? readNotifyBefore(body.notifyBefore) : null;
  if (notify && !notify.ok) return NextResponse.json({ error: notify.error }, { status: 400 });

  const access = await buildItemAccessWhere(user.id);
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: params.id, ...access },
  });
  if (!existing) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  // Déplacer l'événement ou changer son rappel ré-arme le rappel.
  // 0 = « à l'heure de l'événement » : à ne pas confondre avec null (pas de rappel).
  const notifyBefore = notify?.ok ? notify.value : null;
  const rearm =
    (date?.ok === true && date.value.getTime() !== existing.date.getTime()) ||
    (body.recurrence !== undefined &&
      (isRecurrence(body.recurrence) ? body.recurrence : null) !== existing.recurrence) ||
    (body.notifyBefore !== undefined && notifyBefore !== existing.notifyBefore);

  const data = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description }),
    ...(date?.ok && { date: date.value }),
    ...(endDate?.ok && { endDate: endDate.value }),
    ...(body.allDay !== undefined && { allDay: body.allDay }),
    ...(body.recurrence !== undefined && {
      recurrence: isRecurrence(body.recurrence) ? body.recurrence : null,
    }),
    ...(body.color !== undefined && {
      color: isEventColor(body.color) ? body.color : null,
    }),
    ...(body.notifyBefore !== undefined && { notifyBefore }),
    ...(rearm && { notified: false, notifiedOccurrence: null }),
  };

  // Un PATCH qui ne change que les personnes n'a rien d'autre à écrire :
  // updateMany sans données renverrait count 0, pris à tort pour « introuvable ».
  const event =
    Object.keys(data).length > 0
      ? await prisma.calendarEvent.updateMany({ where: { id: params.id, ...access }, data })
      : { count: 1 };

  if (event.count === 0) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  if (body.assigneeIds !== undefined) {
    const assigneeIds = await sanitizeAssigneeIds(body.assigneeIds, existing.groupId);
    await prisma.$transaction([
      prisma.eventAssignee.deleteMany({ where: { eventId: params.id } }),
      prisma.eventAssignee.createMany({
        data: assigneeIds.map((profileId) => ({ eventId: params.id, profileId })),
      }),
    ]);
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
