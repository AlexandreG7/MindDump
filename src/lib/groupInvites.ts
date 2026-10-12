import { prisma } from "./prisma";

/** Liens de foyer en attente (non utilisés, non expirés) autorisés en même temps pour un groupe. */
export const MAX_ACTIVE_GROUP_INVITES = 5;

/** Filtre « lien en attente » : ni utilisé pour rejoindre, ni expiré. */
export const activeGroupInviteWhere = (groupId: string) => ({
  groupId,
  usedAt: null,
  expiresAt: { gt: new Date() },
});

/**
 * Gérer les liens d'invitation d'un groupe (les créer, lire leurs jetons, les révoquer) :
 * propriétaire ou membre au rôle « admin ». Même contrôle partout (POST, GET, DELETE).
 * `null` = groupe introuvable ; sinon `{ canManage }` (un simple membre peut seulement compter).
 */
export async function groupInviteAccess(groupId: string, userId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!group) return null;
  return { canManage: group.ownerId === userId || group.members.some((m) => m.role === "admin") };
}
