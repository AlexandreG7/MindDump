import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, buildResourceWhere, resolveGroupId } from "@/lib/groupAuth";
import { isEventColor, isRecurrence } from "@/lib/recurrence";
import { expandRecurrences } from "@/lib/calendarEvents";
import { readDueDate, readEventDate, readNotifyBefore } from "@/lib/dateInput";
import { assigneesInclude, sanitizeAssigneeIds, withAssigneeIds } from "@/lib/profiles";

const MAX_RANGE_MS = 400 * 86400000;

/**
 * Intervalle demandé : from/to (dates ISO, calculées par le client dans son
 * fuseau), ou month/year (compatibilité : serveur MCP, anciens clients).
 */
function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } | null {
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  if (fromParam && toParam) {
    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return null;
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) return null;
    return { from, to };
  }
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  if (month && year) {
    return {
      from: new Date(Number(year), Number(month) - 1, 1),
      to: new Date(Number(year), Number(month), 0, 23, 59, 59),
    };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");

  if (groupId) {
    const err = await assertGroupMember(groupId, user.id);
    if (err) return err;
  }

  const baseWhere = await buildResourceWhere(user.id, groupId);

  if (searchParams.has("from") || searchParams.has("month")) {
    const range = parseRange(searchParams);
    if (!range) {
      return NextResponse.json({ error: "Intervalle invalide (400 jours au plus)" }, { status: 400 });
    }
    const { from, to } = range;

    const candidates = await prisma.calendarEvent.findMany({
      where: {
        // AND, pas de spread : un second OR écraserait le filtre d'accès.
        AND: [
          ...baseWhere.AND,
          {
            date: { lte: to },
            OR: [
              { recurrence: { not: null, notIn: ["none", ""] } },
              { date: { gte: from } },
              { endDate: { gte: from } },
            ],
          },
        ],
      },
      orderBy: { date: "asc" },
      include: assigneesInclude,
    });

    return NextResponse.json(expandRecurrences(candidates.map(withAssigneeIds), from, to));
  }

  const events = await prisma.calendarEvent.findMany({
    where: baseWhere,
    orderBy: { date: "asc" },
    include: assigneesInclude,
  });

  return NextResponse.json(events.map(withAssigneeIds));
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const groupId = await resolveGroupId(user.id, body.groupId);

  const err = await assertGroupMember(groupId, user.id);
  if (err) return err;

  const date = readEventDate(body.date);
  if (!date.ok) return NextResponse.json({ error: date.error }, { status: 400 });
  const endDate = readDueDate(body.endDate);
  if (!endDate.ok) return NextResponse.json({ error: endDate.error.replace("Échéance", "Fin") }, { status: 400 });
  const notify = readNotifyBefore(body.notifyBefore);
  if (!notify.ok) return NextResponse.json({ error: notify.error }, { status: 400 });

  const assigneeIds = await sanitizeAssigneeIds(body.assigneeIds, groupId);

  const event = await prisma.calendarEvent.create({
    data: {
      title: body.title,
      description: body.description || null,
      date: date.value,
      endDate: endDate.value,
      allDay: body.allDay || false,
      recurrence: isRecurrence(body.recurrence) ? body.recurrence : null,
      color: isEventColor(body.color) ? body.color : null,
      // 0 = « à l'heure de l'événement » : à ne pas confondre avec null (pas de rappel).
      notifyBefore: notify.value,
      userId: user.id,
      groupId,
      assignees: { create: assigneeIds.map((profileId) => ({ profileId })) },
    },
    include: assigneesInclude,
  });

  return NextResponse.json(withAssigneeIds(event), { status: 201 });
}
