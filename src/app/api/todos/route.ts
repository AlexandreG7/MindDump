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

  const todos = await prisma.todo.findMany({
    where,
    orderBy: [{ completed: "asc" }, { position: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(todos);
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

  const todo = await prisma.todo.create({
    data: {
      title: body.title,
      description: body.description || null,
      priority: body.priority || "URGENT",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notifyBefore: body.notifyBefore || null,
      userId: user.id,
      groupId,
    },
  });

  return NextResponse.json(todo, { status: 201 });
}
