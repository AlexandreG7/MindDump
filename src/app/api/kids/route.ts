import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { findAccessibleProfile } from "@/lib/profiles";

// Le semainier appartient à l'enfant (profil du foyer) : tous les membres du
// groupe le voient et le remplissent.
const EDITABLE_FIELDS = ["weather", "mood", "nap", "accident", "activities"] as const;

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!from || !to || !profileId) {
    return NextResponse.json({ error: "from, to and profileId required" }, { status: 400 });
  }
  if (!(await findAccessibleProfile(profileId, user.id))) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const entries = await prisma.kidDayEntry.findMany({
    where: {
      profileId,
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
  const { date, profileId } = body;

  if (!date || typeof date !== "string" || !profileId || typeof profileId !== "string") {
    return NextResponse.json({ error: "date and profileId required" }, { status: 400 });
  }
  if (!(await findAccessibleProfile(profileId, user.id))) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const fields: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) fields[key] = body[key];
  }
  if (Array.isArray(fields.activities)) {
    fields.activities = JSON.stringify(fields.activities);
  }

  const entry = await prisma.kidDayEntry.upsert({
    where: { profileId_date: { profileId, date } },
    create: { userId: user.id, profileId, date, ...fields },
    update: fields,
  });

  return NextResponse.json({
    ...entry,
    activities: JSON.parse(entry.activities || "[]"),
  });
}
