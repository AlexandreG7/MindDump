import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, buildItemAccessWhere, buildResourceWhere, resolveGroupId } from "@/lib/groupAuth";
import { aggregateIngredients, isDay } from "@/lib/meals";

// POST — une seule liste de courses pour tous les repas prévus de from à to
// (ingrédients regroupés, portions prévues prises en compte).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { from, to } = body;
  if (!isDay(from) || !isDay(to) || to < from) {
    return NextResponse.json({ error: "from et to requis (AAAA-MM-JJ)" }, { status: 400 });
  }
  const groupId = body.groupId ? String(body.groupId) : null;
  if (groupId) {
    const err = await assertGroupMember(groupId, user.id);
    if (err) return err;
  }

  const entries = await prisma.mealPlanEntry.findMany({
    where: {
      AND: [...(await buildResourceWhere(user.id, groupId)).AND, { date: { gte: from, lte: to } }, { recipeId: { not: null } }],
    },
    select: {
      servings: true,
      recipe: { select: { id: true, servings: true, ingredients: { select: { name: true, quantity: true, unit: true } } } },
    },
  });

  const lines = entries.flatMap((e) =>
    (e.recipe?.ingredients ?? []).map((i) => ({
      ...i,
      factor: e.servings && e.recipe?.servings ? e.servings / e.recipe.servings : 1,
    }))
  );
  const items = aggregateIngredients(lines);
  if (items.length === 0) {
    return NextResponse.json({ error: "Aucun ingrédient dans les repas prévus" }, { status: 400 });
  }

  let listId: string | null = typeof body.listId === "string" ? body.listId : null;
  if (listId) {
    const list = await prisma.shoppingList.findFirst({ where: { id: listId, ...(await buildItemAccessWhere(user.id)) } });
    if (!list) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });
  } else {
    const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const list = await prisma.shoppingList.create({
      data: {
        name: from === to ? `Courses du ${fmt(from)}` : `Courses du ${fmt(from)} au ${fmt(to)}`,
        type: "GROCERY",
        userId: user.id,
        groupId: await resolveGroupId(user.id, groupId),
      },
    });
    listId = list.id;
  }

  await prisma.shoppingItem.createMany({
    data: items.map((i) => ({ name: i.name, quantity: i.quantity, listId: listId! })),
  });
  return NextResponse.json({ listId, added: items.length, meals: entries.length });
}
