import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { buildItemAccessWhere } from "@/lib/groupAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Liste accessible : propriétaire ou membre du groupe
  const list = await prisma.shoppingList.findFirst({
    where: { id: params.id, ...(await buildItemAccessWhere(user.id)) },
  });
  if (!list) return NextResponse.json({ error: "Non trouve" }, { status: 404 });

  const body = await req.json();
  // listId dans le filtre : un article ne peut être modifié que via sa propre liste
  const updated = await prisma.shoppingItem.updateMany({
    where: { id: params.itemId, listId: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
      ...(body.checked !== undefined && { checked: body.checked }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.price !== undefined && { price: body.price }),
      ...(body.store !== undefined && { store: body.store }),
      ...(body.recipeId !== undefined && { recipeId: body.recipeId }),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const list = await prisma.shoppingList.findFirst({
    where: { id: params.id, ...(await buildItemAccessWhere(user.id)) },
  });
  if (!list) return NextResponse.json({ error: "Non trouve" }, { status: 404 });

  const deleted = await prisma.shoppingItem.deleteMany({
    where: { id: params.itemId, listId: params.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
