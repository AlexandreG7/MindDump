import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Add recipe ingredients to a shopping list
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: user.id },
    include: { ingredients: true },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Recette non trouvee" }, { status: 404 });
  }

  const body = await req.json();
  let listId = body.listId;

  // Create a new list if none specified
  if (!listId) {
    const list = await prisma.shoppingList.create({
      data: {
        name: `Courses - ${recipe.title}`,
        type: "GROCERY",
        userId: user.id,
      },
    });
    listId = list.id;
  }

  // Add ingredients as shopping items
  await prisma.shoppingItem.createMany({
    data: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}`,
      listId,
      recipeId: recipe.id,
    })),
  });

  return NextResponse.json({ listId, count: recipe.ingredients.length });
}
