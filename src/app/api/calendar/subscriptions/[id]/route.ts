import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { fetchICSEvents } from "@/lib/ics";

/**
 * Un abonnement est accessible à son propriétaire et à tous les membres du
 * groupe auquel il est rattaché.
 */
async function findAccessibleSubscription(id: string, userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  return prisma.calendarSubscription.findFirst({
    where: {
      id,
      OR: [
        { userId },
        ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
      ],
    },
  });
}

/** Intervalle facultatif ?from=&to= (ISO), 400 jours au plus ; sinon un an autour d'aujourd'hui. */
function parseRange(req: NextRequest): { from?: Date; to?: Date } | null {
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  if (!fromParam && !toParam) return {};
  const from = new Date(fromParam ?? "");
  const to = new Date(toParam ?? "");
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return null;
  if (to.getTime() - from.getTime() > 400 * 86400000) return null;
  return { from, to };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const sub = await findAccessibleSubscription(params.id, user.id);

  if (!sub) {
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  }

  const range = parseRange(req);
  if (!range) {
    return NextResponse.json({ error: "Intervalle invalide (400 jours au plus)" }, { status: 400 });
  }

  try {
    const events = await fetchICSEvents(sub.url, range.from, range.to);
    return NextResponse.json({
      subscription: {
        id: sub.id,
        name: sub.name,
        color: sub.color,
        enabled: sub.enabled,
        groupId: sub.groupId,
        isOwner: sub.userId === user.id,
      },
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

  // Seul celui qui a ajouté le calendrier peut le retirer du groupe.
  const deleted = await prisma.calendarSubscription.deleteMany({
    where: { id: params.id, userId: user.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Seul le membre qui a ajouté ce calendrier peut le retirer" },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true });
}
