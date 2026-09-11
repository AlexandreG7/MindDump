const { PrismaClient } = require("@prisma/client");

/**
 * Rattache les abonnements calendrier existants (créés avant le partage de
 * groupe) au groupe par défaut de leur propriétaire, pour que les membres du
 * groupe voient eux aussi les événements synchronisés.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const orphans = await prisma.calendarSubscription.findMany({
      where: { groupId: null },
      select: { id: true, userId: true },
    });

    let updated = 0;
    for (const sub of orphans) {
      const membership = await prisma.groupMember.findFirst({
        where: { userId: sub.userId },
        orderBy: { joinedAt: "asc" },
        select: { groupId: true },
      });
      if (!membership) continue;

      await prisma.calendarSubscription.update({
        where: { id: sub.id },
        data: { groupId: membership.groupId },
      });
      updated++;
    }

    if (updated > 0) {
      console.log(`Backfilled groupId for ${updated} calendar subscriptions`);
    }
  } catch (e) {
    console.log(
      "backfill-subscription-groups: skipped (column may not exist yet)"
    );
  } finally {
    await prisma.$disconnect();
  }
}

main();
