import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { buildItemAccessWhere } from "@/lib/groupAuth";
import { isDay, isMealSlot, mealSelect } from "@/lib/meals";

// PATCH — déplacer un repas (jour, créneau) ou changer ses portions / sa note
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await buildItemAccessWhere(user.id);
  const existing = await prisma.mealPlanEntry.findFirst({ where: { id: params.id, ...access }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Repas introuvable" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (isDay(body.date)) data.date = body.date;
  if (isMealSlot(body.slot)) data.slot = body.slot;
  if (body.note === null || typeof body.note === "string") data.note = body.note?.trim()?.slice(0, 120) || null;
  if (body.servings === null || (Number.isInteger(body.servings) && body.servings > 0 && body.servings <= 50)) {
    data.servings = body.servings;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

  const entry = await prisma.mealPlanEntry.update({ where: { id: params.id }, data, select: mealSelect });
  return NextResponse.json(entry);
}

// DELETE — retirer un repas du planning (la recette, elle, reste)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.mealPlanEntry.deleteMany({ where: { id: params.id, ...(await buildItemAccessWhere(user.id)) } });
  return NextResponse.json({ ok: true });
}
