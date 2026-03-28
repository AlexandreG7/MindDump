import { prisma } from "./prisma";

/**
 * Crée un groupe par défaut pour un utilisateur s'il n'en a pas encore.
 * Appelé automatiquement lors de l'inscription ou de la première connexion Google.
 */
export async function ensureDefaultGroup(userId: string, userName?: string | null) {
  const existing = await prisma.group.findFirst({
    where: { ownerId: userId, isDefault: true },
  });
  if (existing) return existing;

  const group = await prisma.group.create({
    data: {
      name: userName ? `Famille de ${userName}` : "Mon groupe",
      isDefault: true,
      ownerId: userId,
      members: {
        create: { userId, role: "admin" },
      },
    },
  });

  return group;
}
