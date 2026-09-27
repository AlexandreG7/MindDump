const { PrismaClient } = require("@prisma/client");

/**
 * Le semainier était rangé par parent (userId), sans dire de quel enfant il
 * s'agissait. Chaque parent qui l'a utilisé reçoit un profil enfant « Mon enfant »
 * dans son groupe par défaut, et ses saisies y sont rattachées. Le prénom se
 * change ensuite dans Groupes. Sans effet une fois toutes les saisies rattachées.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const authors = await prisma.kidDayEntry.findMany({
      where: { profileId: null },
      select: { userId: true },
      distinct: ["userId"],
    });

    let attached = 0;
    for (const { userId } of authors) {
      const group =
        (await prisma.group.findFirst({
          where: { ownerId: userId },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: { id: true },
        })) ??
        (await prisma.groupMember.findFirst({
          where: { userId },
          orderBy: { joinedAt: "asc" },
          select: { group: { select: { id: true } } },
        }))?.group;
      if (!group) continue;

      const position = await prisma.familyProfile.count({ where: { groupId: group.id } });
      const { count } = await prisma.$transaction(async (tx) => {
        const profile = await tx.familyProfile.create({
          data: { groupId: group.id, name: "Mon enfant", kind: "child", color: "#ec4899", position },
        });
        return tx.kidDayEntry.updateMany({
          where: { userId, profileId: null },
          data: { profileId: profile.id },
        });
      });
      attached += count;
    }

    if (attached > 0) {
      console.log(`Attached ${attached} kid diary entries to a child profile`);
    }
  } catch (e) {
    console.log("backfill-kid-profiles: skipped (" + e.message + ")");
  } finally {
    await prisma.$disconnect();
  }
}

main();
