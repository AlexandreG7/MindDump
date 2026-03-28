import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Verify list ownership
  const list = await prisma.shoppingList.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!list) return NextResponse.json({ error: "Non trouve" }, { status: 404 });

  const body = await req.json();

  // Support adding multiple items at once (for recipes)
  if (Array.isArray(body)) {
    const items = await prisma.shoppingItem.createMany({
      data: body.map((item: Record<string, unknown>) => ({
        name: item.name as string,
        quantity: (item.quantity as string) || null,
        category: (item.category as string) || null,
        url: (item.url as string) || null,
        price: (item.price as number) || null,
        store: (item.store as string) || null,
        recipeId: (item.recipeId as string) || null,
        listId: params.id,
      })),
    });
    return NextResponse.json(items, { status: 201 });
  }

  const item = await prisma.shoppingItem.create({
    data: {
      name: body.name,
      quantity: body.quantity || null,
      category: body.category || null,
      url: body.url || null,
      price: body.price || null,
      store: body.store || null,
      recipeId: body.recipeId || null,
      listId: params.id,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
