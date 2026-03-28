import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, buildResourceWhere } from "@/lib/groupAuth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const groupId = new URL(req.url).searchParams.get("groupId");

  if (groupId) {
    const err = await assertGroupMember(groupId, user.id);
    if (err) return err;
  }

  const where = await buildResourceWhere(user.id, groupId);

  const recipes = await prisma.recipe.findMany({
    where,
    include: { ingredients: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recipes);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const groupId: string | null = body.groupId || null;

  if (groupId) {
    const err = await assertGroupMember(groupId, user.id);
    if (err) return err;
  }

  const recipe = await prisma.recipe.create({
    data: {
      title: body.title,
      description: body.description || null,
      servings: body.servings || 4,
      prepTime: body.prepTime || null,
      cookTime: body.cookTime || null,
      steps: JSON.stringify(body.steps || []),
      planned: body.planned === true,
      userId: user.id,
      groupId,
      ingredients: {
        create: (body.ingredients || []).map(
          (ing: { name: string; quantity: string; unit?: string }) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit || null,
          })
        ),
      },
    },
    include: { ingredients: true },
  });

  return NextResponse.json(recipe, { status: 201 });
}
