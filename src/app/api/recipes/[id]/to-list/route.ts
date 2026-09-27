import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { buildItemAccessWhere, resolveGroupId } from "@/lib/groupAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, ...(await buildItemAccessWhere(user.id)) },
    include: { ingredients: true },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Recette non trouvee" }, { status: 404 });
  }

  const body = await req.json();
  let listId = body.listId;

  if (listId) {
    // La liste doit être accessible (la sienne ou celle d'un de ses groupes).
    const list = await prisma.shoppingList.findFirst({
      where: { id: listId, ...(await buildItemAccessWhere(user.id)) },
      select: { id: true },
    });
    if (!list) {
      return NextResponse.json({ error: "Liste non trouvee" }, { status: 404 });
    }
  } else {
    // Même groupe que la recette : la liste est partagée avec ses membres.
    const member = recipe.groupId
      ? await prisma.groupMember.findFirst({ where: { groupId: recipe.groupId, userId: user.id } })
      : null;
    const list = await prisma.shoppingList.create({
      data: {
        name: `Courses - ${recipe.title}`,
        type: "GROCERY",
        userId: user.id,
        groupId: member ? recipe.groupId : await resolveGroupId(user.id, null),
      },
    });
    listId = list.id;
  }

  await prisma.shoppingItem.createMany({
    data: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}`,
      listId,
      recipeId: recipe.id,
    })),
  });

  return NextResponse.json({ listId, added: recipe.ingredients.length });
}
