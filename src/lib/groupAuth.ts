import { prisma } from "./prisma";
import { NextResponse } from "next/server";
import { ensureDefaultGroup } from "./defaultGroup";

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
 * Vérifie si l'utilisateur est admin du groupe (propriétaire ou membre au rôle "admin").
 */
export async function isGroupAdmin(
  groupId: string,
  userId: string,
  ownerId?: string
): Promise<boolean> {
  if (ownerId !== undefined && ownerId === userId) return true;
  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId, role: "admin" },
  });
  return !!member;
}

/**
 * Résout le groupId pour une création de ressource.
 * Si groupId fourni → le retourne tel quel.
 * Sinon → retourne le groupe par défaut de l'utilisateur.
 */
export async function resolveGroupId(
  userId: string,
  groupId: string | null | undefined
): Promise<string> {
  if (groupId) return groupId;
  const defaultGroup = await ensureDefaultGroup(userId);
  return defaultGroup.id;
}

async function memberGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  return memberships.map((m) => m.groupId);
}

/**
 * Construit le filtre Prisma d'une liste de ressources (recettes, tâches, listes,
 * événements, abonnements).
 *
 * Règle absolue : un élément reste TOUJOURS visible par son auteur (userId),
 * quel que soit le sort de son groupe. Un groupe supprimé (groupId passé à null)
 * ou quitté ne doit jamais faire disparaître ce que la personne a créé.
 *
 * - groupId fourni (vue d'un groupe, celle de l'interface) → les éléments du
 *   groupe, plus les éléments « orphelins » de l'utilisateur : sans groupe, ou
 *   dans un groupe dont il n'est plus membre.
 * - pas de groupId → tous les éléments de l'utilisateur + ceux de ses groupes.
 *
 * Le filtre tient dans une seule clé AND : l'appelant qui ajoute ses propres
 * conditions doit les combiner avec AND, jamais écraser la clé (voir calendar).
 */
export async function buildResourceWhere(
  userId: string,
  groupId: string | null
): Promise<{ AND: Record<string, unknown>[] }> {
  const groupIds = await memberGroupIds(userId);

  if (groupId) {
    return {
      AND: [
        {
          OR: [
            { groupId },
            { userId, groupId: null },
            { userId, groupId: { notIn: groupIds } },
          ],
        },
      ],
    };
  }

  return {
    AND: [
      {
        OR: [
          { userId },
          ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
        ],
      },
    ],
  };
}

/**
 * Construit le filtre Prisma d'accès à une ressource unique (/api/xxx/[id]) :
 * le propriétaire, ou n'importe quel membre du groupe auquel elle est rattachée.
 * Même règle de visibilité que buildResourceWhere, qui alimente les listes.
 */
export async function buildItemAccessWhere(
  userId: string
): Promise<{ OR: ({ userId: string } | { groupId: { in: string[] } })[] }> {
  const groupIds = await memberGroupIds(userId);

  return {
    OR: [
      { userId },
      ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
    ],
  };
}
