import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, buildItemAccessWhere, buildResourceWhere, resolveGroupId } from "@/lib/groupAuth";
import { isDay, isMealSlot, mealSelect } from "@/lib/meals";

// GET — repas prévus entre from et to (jours « yyyy-MM-dd », 62 jours au plus)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const groupId = searchParams.get("groupId");
  if (!isDay(from) || !isDay(to) || to < from) {
    return NextResponse.json({ error: "from et to requis (AAAA-MM-JJ)" }, { status: 400 });
  }
  if (Date.parse(to) - Date.parse(from) > 62 * 86400000) {
    return NextResponse.json({ error: "Intervalle trop long (62 jours au plus)" }, { status: 400 });
  }
  if (groupId) {
    const err = await assertGroupMember(groupId, user.id);
    if (err) return err;
  }

  const entries = await prisma.mealPlanEntry.findMany({
    where: { AND: [...(await buildResourceWhere(user.id, groupId)).AND, { date: { gte: from, lte: to } }] },
    select: mealSelect,
    orderBy: [{ date: "asc" }, { slot: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(entries);
}

// POST — prévoir une recette (ou une note : « restes », « resto ») un jour, midi ou soir
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  if (!isDay(body.date) || !isMealSlot(body.slot)) {
    return NextResponse.json({ error: "date (AAAA-MM-JJ) et slot (lunch | dinner) requis" }, { status: 400 });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 120) : null;

  let recipeId: string | null = null;
  if (body.recipeId) {
    const recipe = await prisma.recipe.findFirst({
      where: { id: String(body.recipeId), ...(await buildItemAccessWhere(user.id)) },
      select: { id: true },
    });
    if (!recipe) return NextResponse.json({ error: "Recette introuvable" }, { status: 404 });
    recipeId = recipe.id;
  }
  if (!recipeId && !note) {
    return NextResponse.json({ error: "Une recette ou une note est requise" }, { status: 400 });
  }

  const groupId = await resolveGroupId(user.id, body.groupId);
  const err = await assertGroupMember(groupId, user.id);
  if (err) return err;

  // Placer une recette dans la semaine la rend « prévue » (même liste que l'onglet Prévues).
  if (recipeId) await prisma.recipe.update({ where: { id: recipeId }, data: { planned: true } });

  const entry = await prisma.mealPlanEntry.create({
    data: {
      date: body.date,
      slot: body.slot,
      note,
      servings: Number.isInteger(body.servings) && body.servings > 0 && body.servings <= 50 ? body.servings : null,
      recipeId,
      userId: user.id,
      groupId,
    },
    select: mealSelect,
  });
  return NextResponse.json(entry, { status: 201 });
}
