import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Create a recipe from shopping list items
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const list = await prisma.shoppingList.findFirst({
    where: { id: params.id, userId: user.id },
    include: { items: true },
  });

  if (!list) {
    return NextResponse.json({ error: "Liste non trouvee" }, { status: 404 });
  }

  const body = await req.json();
  const itemIds: string[] = body.itemIds || [];
  const items = itemIds.length > 0
    ? list.items.filter((i) => itemIds.includes(i.id))
    : list.items.filter((i) => !i.checked);

  const recipe = await prisma.recipe.create({
    data: {
      title: body.title || list.name,
      description: body.description || null,
      servings: body.servings || 4,
      prepTime: body.prepTime || null,
      cookTime: body.cookTime || null,
      steps: JSON.stringify(body.steps || []),
      userId: user.id,
      ingredients: {
        create: items.map((item) => ({
          name: item.name,
          quantity: item.quantity || "1",
          unit: null,
        })),
      },
    },
    include: { ingredients: true },
  });

  // Link the items to the new recipe
  if (items.length > 0) {
    await prisma.shoppingItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { recipeId: recipe.id },
    });
  }

  return NextResponse.json(recipe, { status: 201 });
}
