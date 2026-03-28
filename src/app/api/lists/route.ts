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

  const lists = await prisma.shoppingList.findMany({
    where,
    include: {
      items: {
        include: { recipe: { select: { id: true, title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(lists);
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

  const list = await prisma.shoppingList.create({
    data: {
      name: body.name,
      type: body.type || "GROCERY",
      userId: user.id,
      groupId,
    },
    include: { items: true },
  });

  return NextResponse.json(list, { status: 201 });
}
