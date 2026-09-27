import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, buildResourceWhere, resolveGroupId } from "@/lib/groupAuth";
import { isEventColor, isRecurrence, occurrencesBetween } from "@/lib/recurrence";

type EventRow = Awaited<ReturnType<typeof prisma.calendarEvent.findMany>>[number];

/**
 * Événements qui touchent [from, to], récurrences développées. Une occurrence
 * autre que la première porte l'id `<id>_<date iso>` (l'interface agit toujours
 * sur l'événement source).
 */
function expandRecurrences(events: EventRow[], from: Date, to: Date) {
  const result: EventRow[] = [];
  for (const event of events) {
    const recurrence = event.recurrence && event.recurrence !== "none" ? event.recurrence : null;
    for (const occ of occurrencesBetween(event.date, event.endDate, recurrence, from, to)) {
      result.push({
        ...event,
        id: occ.date.getTime() === event.date.getTime() ? event.id : `${event.id}_${occ.date.toISOString()}`,
        date: occ.date,
        endDate: occ.endDate,
      });
    }
  }
  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

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
    });

    return NextResponse.json(expandRecurrences(candidates, from, to));
  }

  const events = await prisma.calendarEvent.findMany({
    where: baseWhere,
    orderBy: { date: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const groupId = await resolveGroupId(user.id, body.groupId);

  const err = await assertGroupMember(groupId, user.id);
  if (err) return err;

  const event = await prisma.calendarEvent.create({
    data: {
      title: body.title,
      description: body.description || null,
      date: new Date(body.date),
      endDate: body.endDate ? new Date(body.endDate) : null,
      allDay: body.allDay || false,
      recurrence: isRecurrence(body.recurrence) ? body.recurrence : null,
      color: isEventColor(body.color) ? body.color : null,
      notifyBefore: body.notifyBefore || null,
      userId: user.id,
      groupId,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
