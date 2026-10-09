import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateTimeInput } from "@/lib/dateInput";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, buildResourceWhere, resolveGroupId } from "@/lib/groupAuth";
import { isRecurrence } from "@/lib/recurrence";
import { assigneesInclude, sanitizeAssigneeIds, withAssigneeIds } from "@/lib/profiles";

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
    include: assigneesInclude,
  });

  return NextResponse.json(todos.map(withAssigneeIds));
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const groupId = await resolveGroupId(user.id, body.groupId);

  const err = await assertGroupMember(groupId, user.id);
  if (err) return err;

  const assigneeIds = await sanitizeAssigneeIds(body.assigneeIds, groupId);

  const todo = await prisma.todo.create({
    data: {
      title: body.title,
      description: body.description || null,
      priority: body.priority || "URGENT",
      dueDate: body.dueDate ? parseDateTimeInput(body.dueDate) : null,
      recurrence: isRecurrence(body.recurrence) ? body.recurrence : null,
      notifyBefore: body.notifyBefore || null,
      userId: user.id,
      groupId,
      assignees: { create: assigneeIds.map((profileId) => ({ profileId })) },
    },
    include: assigneesInclude,
  });

  return NextResponse.json(withAssigneeIds(todo), { status: 201 });
}
