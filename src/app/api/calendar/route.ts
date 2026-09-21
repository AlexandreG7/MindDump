import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, buildResourceWhere, resolveGroupId } from "@/lib/groupAuth";
import { isEventColor, isRecurrence, nextOccurrence } from "@/lib/recurrence";

function expandRecurrences(
  events: Array<{
    id: string;
    title: string;
    description: string | null;
    date: Date;
    endDate: Date | null;
    allDay: boolean;
    recurrence: string | null;
    color: string | null;
    notifyBefore: number | null;
    notified: boolean;
    notifiedOccurrence: Date | null;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    groupId: string | null;
  }>,
  rangeStart: Date,
  rangeEnd: Date
) {
  const result: typeof events = [];

  for (const event of events) {
    if (!event.recurrence || event.recurrence === "none") {
      if (event.date >= rangeStart && event.date <= rangeEnd) {
        result.push(event);
      }
      continue;
    }

    let current = new Date(event.date);
    let safetyLimit = 400;

    while (current <= rangeEnd && safetyLimit-- > 0) {
      if (current >= rangeStart) {
        const duration =
          event.endDate
            ? event.endDate.getTime() - event.date.getTime()
            : 0;
        result.push({
          ...event,
          id:
            current.getTime() === event.date.getTime()
              ? event.id
              : `${event.id}_${current.toISOString()}`,
          date: new Date(current),
          endDate: duration ? new Date(current.getTime() + duration) : null,
        });
      }

      const next = nextOccurrence(current, event.recurrence);
      if (!next) {
        safetyLimit = 0;
      } else {
        current = next;
      }
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const groupId = searchParams.get("groupId");

  if (groupId) {
    const err = await assertGroupMember(groupId, user.id);
    if (err) return err;
  }

  const baseWhere = await buildResourceWhere(user.id, groupId);

  if (month && year) {
    const rangeStart = new Date(Number(year), Number(month) - 1, 1);
    const rangeEnd = new Date(Number(year), Number(month), 0, 23, 59, 59);

    const allEvents = await prisma.calendarEvent.findMany({
      where: {
        ...baseWhere,
        OR: [
          { date: { lte: rangeEnd }, recurrence: { not: null, notIn: ["none", ""] } },
          { date: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      orderBy: { date: "asc" },
    });

    const expanded = expandRecurrences(allEvents, rangeStart, rangeEnd);
    expanded.sort((a, b) => a.date.getTime() - b.date.getTime());
    return NextResponse.json(expanded);
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
