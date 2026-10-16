import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { isGroupAdmin } from "@/lib/profiles";

// DELETE — révoquer un écran mural : son lien cesse aussitôt de fonctionner.
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const device = await prisma.wallDevice.findUnique({ where: { id: params.id }, select: { groupId: true } });
  if (!device || !(await isGroupAdmin(device.groupId, user.id))) {
    return NextResponse.json({ error: "Écran introuvable" }, { status: 404 });
  }
  await prisma.wallDevice.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
