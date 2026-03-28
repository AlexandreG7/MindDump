import { prisma } from "./prisma";
import { NextResponse } from "next/server";

/**
 * Vérifie que l'utilisateur est membre du groupe.
 * Retourne une erreur 403 si non.
 */
export async function assertGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });
  if (!member) {
    return NextResponse.json({ error: "Non membre de ce groupe" }, { status: 403 });
  }
  return null; // OK
}

/**
 * Construit le filtre Prisma pour une ressource qui peut être personnelle ou de groupe.
 * - groupId fourni → filtre par groupe (après vérification membership)
 * - pas de groupId → tous les items de l'utilisateur + ceux de ses groupes
 */
export async function buildResourceWhere(
  userId: string,
  groupId: string | null
): Promise<Record<string, unknown>> {
  if (groupId) {
    return { groupId };
  }

  // Récupère tous les groupes de l'utilisateur
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  return {
    OR: [
      { userId, groupId: null },
      ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
    ],
  };
}
