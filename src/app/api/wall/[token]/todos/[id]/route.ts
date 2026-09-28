import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findWallDevice } from "@/lib/wall";
import { createNextOccurrence } from "@/lib/todos";

// Cocher une tâche du groupe depuis l'écran mural (et recréer l'occurrence
// suivante d'une tâche récurrente, comme dans l'app).
export async function POST(req: NextRequest, { params }: { params: { token: string; id: string } }) {
  const device = await findWallDevice(params.token);
  if (!device) return NextResponse.json({ error: "Écran inconnu ou révoqué" }, { status: 404 });

  const { completed } = await req.json().catch(() => ({}));
  if (typeof completed !== "boolean") return NextResponse.json({ error: "completed requis" }, { status: 400 });

  const todo = await prisma.todo.findFirst({
    where: { id: params.id, groupId: device.groupId },
    include: { assignees: { select: { profileId: true } } },
  });
  if (!todo) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });

  await prisma.todo.update({ where: { id: todo.id }, data: { completed } });
  if (completed && !todo.completed) {
    await createNextOccurrence(todo, todo.assignees.map((a) => a.profileId));
  }
  return NextResponse.json({ ok: true });
}
