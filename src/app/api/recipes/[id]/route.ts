import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: user.id },
    include: { ingredients: true },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  return NextResponse.json(recipe);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();

  // Replace all ingredients if provided
  if (body.ingredients) {
    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: params.id },
    });
    await prisma.recipeIngredient.createMany({
      data: body.ingredients.map(
        (ing: { name: string; quantity: string; unit?: string }) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit || null,
          recipeId: params.id,
        })
      ),
    });
  }

  // Add ingredients without removing existing ones
  if (body.addIngredients) {
    await prisma.recipeIngredient.createMany({
      data: body.addIngredients.map(
        (ing: { name: string; quantity: string; unit?: string }) => ({
          name: ing.name,
          quantity: ing.quantity || "1",
          unit: ing.unit || null,
          recipeId: params.id,
        })
      ),
    });
  }

  await prisma.recipe.updateMany({
    where: { id: params.id, userId: user.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.servings !== undefined && { servings: body.servings }),
      ...(body.prepTime !== undefined && { prepTime: body.prepTime }),
      ...(body.cookTime !== undefined && { cookTime: body.cookTime }),
      ...(body.steps !== undefined && { steps: JSON.stringify(body.steps) }),
      ...(body.image !== undefined && { image: body.image }),
      ...(body.planned !== undefined && { planned: body.planned }),
      ...(body.groupId !== undefined && { groupId: body.groupId || null }),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.recipe.deleteMany({
    where: { id: params.id, userId: user.id },
  });

  return NextResponse.json({ success: true });
}
