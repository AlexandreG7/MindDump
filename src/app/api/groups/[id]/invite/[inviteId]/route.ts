import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { groupInviteAccess } from "@/lib/groupInvites";

// DELETE — révoquer une invitation en attente (libère une des 5 places). Propriétaire ou admin.
// Une invitation déjà utilisée n'est pas touchée : l'adhésion est faite, le lien n'y change rien.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; inviteId: string } }
) {
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await groupInviteAccess(params.id, user.id);
  if (!access) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  // Le filtre sur le groupe empêche de révoquer le lien d'un autre groupe avec son seul id.
  const removed = await prisma.groupInvite.deleteMany({
    where: { id: params.inviteId, groupId: params.id, usedAt: null },
  });
  if (removed.count === 0) return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
