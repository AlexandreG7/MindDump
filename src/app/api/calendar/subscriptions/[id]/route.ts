import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { fetchICSEvents } from "@/lib/ics";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const sub = await prisma.calendarSubscription.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!sub) {
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  }

  try {
    const events = await fetchICSEvents(sub.url);
    return NextResponse.json({
      subscription: sub,
      events: events.map((e) => ({
        id: `sub_${sub.id}_${e.uid}`,
        title: e.title,
        description: e.description,
        date: e.date.toISOString(),
        endDate: e.endDate?.toISOString() ?? null,
        allDay: e.allDay,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        color: sub.color,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible de récupérer le calendrier" },
      { status: 502 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.calendarSubscription.deleteMany({
    where: { id: params.id, userId: user.id },
  });

  return NextResponse.json({ success: true });
}
