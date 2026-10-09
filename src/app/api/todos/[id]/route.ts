import { NextRequest, NextResponse } from "next/server";
import type { Todo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateTimeInput } from "@/lib/dateInput";
import { getSessionUser, unauthorized } from "@/lib/session";
import { buildItemAccessWhere } from "@/lib/groupAuth";
import { isRecurrence } from "@/lib/recurrence";
import { createNextOccurrence } from "@/lib/todos";
import { assigneesInclude, sanitizeAssigneeIds } from "@/lib/profiles";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();

  const access = await buildItemAccessWhere(user.id);
  const existing = await prisma.todo.findFirst({
    where: { id: params.id, ...access },
    include: assigneesInclude,
  });

  if (!existing) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  // 0 = « à l'heure de l'échéance » : à ne pas confondre avec null (pas de rappel).
  const notifyBefore =
    Number.isInteger(body.notifyBefore) && body.notifyBefore >= 0 ? (body.notifyBefore as number) : null;

  const data = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.priority !== undefined && { priority: body.priority }),
    ...(body.completed !== undefined && { completed: body.completed }),
    ...(body.dueDate !== undefined && {
      dueDate: body.dueDate ? parseDateTimeInput(body.dueDate) : null,
    }),
    ...(body.recurrence !== undefined && {
      recurrence: isRecurrence(body.recurrence) ? body.recurrence : null,
    }),
    ...(body.notifyBefore !== undefined && { notifyBefore }),
    // Déplacer l'échéance ou changer le rappel ré-arme le rappel.
    ...(((body.dueDate !== undefined &&
      (body.dueDate ? parseDateTimeInput(body.dueDate).getTime() : null) !==
        (existing.dueDate?.getTime() ?? null)) ||
      (body.notifyBefore !== undefined &&
        notifyBefore !== existing.notifyBefore)) && {
      notified: false,
    }),
    ...(body.position !== undefined && { position: body.position }),
  };

  // Un PATCH qui ne change que les personnes n'a rien d'autre à écrire :
  // updateMany sans données renverrait count 0, pris à tort pour « introuvable ».
  const todo =
    Object.keys(data).length > 0
      ? await prisma.todo.updateMany({ where: { id: params.id, ...access }, data })
      : { count: 1 };

  if (todo.count === 0) {
    return NextResponse.json({ error: "Non trouve" }, { status: 404 });
  }

  let assigneeIds = existing.assignees.map((a) => a.profileId);
  if (body.assigneeIds !== undefined) {
    assigneeIds = await sanitizeAssigneeIds(body.assigneeIds, existing.groupId);
    await prisma.$transaction([
      prisma.todoAssignee.deleteMany({ where: { todoId: params.id } }),
      prisma.todoAssignee.createMany({
        data: assigneeIds.map((profileId) => ({ todoId: params.id, profileId })),
      }),
    ]);
  }

  // Tache recurrente cochee : on genere automatiquement l'occurrence suivante.
  let next: (Todo & { assigneeIds: string[] }) | null = null;
  if (body.completed === true && !existing.completed) {
    next = await createNextOccurrence(existing, assigneeIds);
  }

  return NextResponse.json({ success: true, next });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.todo.deleteMany({
    where: { id: params.id, ...(await buildItemAccessWhere(user.id)) },
  });

  return NextResponse.json({ success: true });
}
