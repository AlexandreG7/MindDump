import { prisma } from "./prisma";
import { EVENT_COLORS, isEventColor } from "./recurrence";

export type ProfileKind = "adult" | "child";

export const PROFILE_KINDS: Array<{ value: ProfileKind; label: string }> = [
  { value: "adult", label: "Adulte" },
  { value: "child", label: "Enfant" },
];

export function isProfileKind(value: unknown): value is ProfileKind {
  return value === "adult" || value === "child";
}

export function isBirthDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export { isEventColor as isProfileColor };

export const profileSelect = {
  id: true,
  name: true,
  kind: true,
  color: true,
  emoji: true,
  birthDate: true,
  position: true,
  groupId: true,
  userId: true,
  user: { select: { image: true } },
} as const;

/** Première couleur de la palette que personne n'utilise encore dans le foyer. */
export function nextProfileColor(used: string[], offset = 0): string {
  const free = EVENT_COLORS.filter((c) => !used.includes(c.value));
  const pool = free.length > 0 ? free : EVENT_COLORS;
  return pool[offset % pool.length].value;
}

/**
 * Aligne les profils « membre » d'un groupe sur ses adhésions : un profil par
 * membre (créé à la première lecture), aucun pour un ancien membre. Les profils
 * sans compte (enfants) ne sont pas touchés. Renvoie tous les profils du groupe.
 */
export async function syncGroupProfiles(groupId: string) {
  const [members, profiles] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
    prisma.familyProfile.findMany({
      where: { groupId },
      select: { id: true, userId: true, color: true, position: true },
    }),
  ]);

  const memberIds = new Set(members.map((m) => m.userId));
  const stale = profiles.filter((p) => p.userId && !memberIds.has(p.userId));
  const missing = members.filter((m) => !profiles.some((p) => p.userId === m.userId));

  if (stale.length > 0) {
    await prisma.familyProfile.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } });
  }
  if (missing.length > 0) {
    const used = profiles.map((p) => p.color);
    const maxPosition = profiles.reduce((max, p) => Math.max(max, p.position), -1);
    await prisma.familyProfile.createMany({
      // Deux lectures simultanées : la contrainte (groupId, userId) garde un seul profil.
      skipDuplicates: true,
      data: missing.map((m, i) => ({
        groupId,
        userId: m.userId,
        name: m.user.name?.trim() || m.user.email?.split("@")[0] || "Membre",
        kind: "adult",
        color: nextProfileColor(used, i),
        position: maxPosition + 1 + i,
      })),
    });
  }

  return prisma.familyProfile.findMany({
    where: { groupId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: profileSelect,
  });
}

/** Retire le profil d'une personne qui quitte le groupe (son compte, lui, reste). */
export async function removeMemberProfile(groupId: string, userId: string) {
  await prisma.familyProfile.deleteMany({ where: { groupId, userId } });
}

/** Le profil, si l'utilisateur est membre du groupe auquel il appartient. */
export async function findAccessibleProfile(profileId: string, userId: string) {
  return prisma.familyProfile.findFirst({
    where: { id: profileId, group: { members: { some: { userId } } } },
    select: { ...profileSelect, group: { select: { ownerId: true } } },
  });
}

/** Admin du groupe (propriétaire ou rôle admin) : seul à gérer les profils des autres. */
export async function isGroupAdmin(groupId: string, userId: string) {
  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId },
    select: { role: true, group: { select: { ownerId: true } } },
  });
  return !!member && (member.role === "admin" || member.group.ownerId === userId);
}

/**
 * Personnes assignables à un élément : seulement des profils de son groupe
 * (un identifiant inconnu ou d'un autre foyer est ignoré, sans erreur).
 */
export async function sanitizeAssigneeIds(value: unknown, groupId: string | null): Promise<string[]> {
  if (!groupId || !Array.isArray(value)) return [];
  const ids = Array.from(new Set(value.filter((v): v is string => typeof v === "string"))).slice(0, 50);
  if (ids.length === 0) return [];
  const profiles = await prisma.familyProfile.findMany({
    where: { id: { in: ids }, groupId },
    select: { id: true },
  });
  return profiles.map((p) => p.id);
}

export const assigneesInclude = { assignees: { select: { profileId: true } } } as const;

/** `assignees: [{ profileId }]` (Prisma) → `assigneeIds: string[]` (API). */
export function withAssigneeIds<T extends { assignees: { profileId: string }[] }>(row: T) {
  const { assignees, ...rest } = row;
  return { ...rest, assigneeIds: assignees.map((a) => a.profileId) };
}
