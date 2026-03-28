import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Verify list ownership
  const list = await prisma.shoppingList.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!list) return NextResponse.json({ error: "Non trouve" }, { status: 404 });

  const body = await req.json();
  await prisma.shoppingItem.update({
    where: { id: params.itemId },
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

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const list = await prisma.shoppingList.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!list) return NextResponse.json({ error: "Non trouve" }, { status: 404 });

  await prisma.shoppingItem.delete({ where: { id: params.itemId } });

  return NextResponse.json({ success: true });
}
