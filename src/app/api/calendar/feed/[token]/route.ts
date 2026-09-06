import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatDateICS(date: Date, allDay: boolean): string {
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function foldLine(line: string): string {
  const maxLen = 75;
  if (line.length <= maxLen) return line;
  const parts: string[] = [];
  parts.push(line.slice(0, maxLen));
  let pos = maxLen;
  while (pos < line.length) {
    parts.push(" " + line.slice(pos, pos + maxLen - 1));
    pos += maxLen - 1;
  }
  return parts.join("\r\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const user = await prisma.user.findUnique({
    where: { calendarToken: params.token },
    select: { id: true, name: true },
  });

  if (!user) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const events = await prisma.calendarEvent.findMany({
    where: {
      OR: [
        { userId: user.id, groupId: null },
        ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
      ],
    },
    orderBy: { date: "asc" },
  });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MindDump//Calendar//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(user.name || "MindDump")}`,
    "X-WR-TIMEZONE:Europe/Paris",
  ];

  for (const event of events) {
    const dtStart = formatDateICS(event.date, event.allDay);
    const dtEnd = event.endDate
      ? formatDateICS(event.endDate, event.allDay)
      : event.allDay
        ? formatDateICS(new Date(event.date.getTime() + 86400000), true)
        : formatDateICS(new Date(event.date.getTime() + 3600000), false);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@minddump`);
    lines.push(
      `DTSTAMP:${formatDateICS(event.updatedAt || event.createdAt, false)}`
    );

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    } else {
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
    }

    lines.push(foldLine(`SUMMARY:${escapeICS(event.title)}`));

    if (event.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeICS(event.description)}`));
    }

    if (event.recurrence) {
      const rruleMap: Record<string, string> = {
        daily: "FREQ=DAILY",
        weekly: "FREQ=WEEKLY",
        monthly: "FREQ=MONTHLY",
      };
      if (rruleMap[event.recurrence]) {
        lines.push(`RRULE:${rruleMap[event.recurrence]}`);
      }
    }

    if (event.notifyBefore) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push("DESCRIPTION:Rappel");
      lines.push(`TRIGGER:-PT${event.notifyBefore}M`);
      lines.push("END:VALARM");
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="minddump.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
