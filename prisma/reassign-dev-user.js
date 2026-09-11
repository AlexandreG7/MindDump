/**
 * Migration ponctuelle et IDEMPOTENTE.
 *
 * Contexte : l'app a longtemps tourné avec SKIP_AUTH=true. Toutes les données ont
 * donc été créées sous un utilisateur synthétique `dev-user`. Une fois la vraie
 * authentification réactivée, le compte réel de l'utilisateur (email) ne voit plus
 * ces données. Ce script réattribue tout ce qui appartient à `dev-user` vers le
 * compte réel identifié par son email.
 *
 * - Cible : env MIGRATE_TARGET_EMAIL (fallback: alexandre.guerlach@gmail.com).
 * - Ne fait RIEN si `dev-user` n'existe pas, si aucune cible n'est trouvée, ou si
 *   la cible est déjà `dev-user`. Rejouable sans effet une fois la migration faite.
 * - Tout est fait dans une transaction (atomique) et loggé (avant/après).
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DEV_ID = "dev-user";
const TARGET_EMAIL = process.env.MIGRATE_TARGET_EMAIL || "alexandre.guerlach@gmail.com";

async function counts(userId) {
  const [todos, events, subs, lists, recipes, kids, keys, flags, ownedGroups, memberships] =
    await Promise.all([
      prisma.todo.count({ where: { userId } }),
      prisma.calendarEvent.count({ where: { userId } }),
      prisma.calendarSubscription.count({ where: { userId } }),
      prisma.shoppingList.count({ where: { userId } }),
      prisma.recipe.count({ where: { userId } }),
      prisma.kidDayEntry.count({ where: { userId } }),
      prisma.apiKey.count({ where: { userId } }),
      prisma.userFeatureFlag.count({ where: { userId } }),
      prisma.group.count({ where: { ownerId: userId } }),
      prisma.groupMember.count({ where: { userId } }),
    ]);
  return { todos, events, subs, lists, recipes, kids, keys, flags, ownedGroups, memberships };
}

async function main() {
  console.log("[reassign] === MIGRATION dev-user -> compte reel ===");

  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("[reassign] Utilisateurs presents :");
  for (const u of allUsers) {
    console.log(`  - id=${u.id} email=${u.email} name=${u.name}`);
  }

  const dev = allUsers.find((u) => u.id === DEV_ID);
  if (!dev) {
    console.log("[reassign] Pas de dev-user -> rien a faire.");
    return;
  }

  const target = allUsers.find(
    (u) => u.id !== DEV_ID && u.email && u.email.toLowerCase() === TARGET_EMAIL.toLowerCase()
  );
  if (!target) {
    console.log(`[reassign] AUCUNE cible pour email=${TARGET_EMAIL}. Aucune modification.`);
    return;
  }

  console.log(`[reassign] dev-user avant :`, JSON.stringify(await counts(DEV_ID)));
  console.log(`[reassign] cible (${target.email} / ${target.id}) avant :`, JSON.stringify(await counts(target.id)));

  await prisma.$transaction(async (tx) => {
    await tx.todo.updateMany({ where: { userId: DEV_ID }, data: { userId: target.id } });
    await tx.calendarEvent.updateMany({ where: { userId: DEV_ID }, data: { userId: target.id } });
    await tx.calendarSubscription.updateMany({ where: { userId: DEV_ID }, data: { userId: target.id } });
    await tx.shoppingList.updateMany({ where: { userId: DEV_ID }, data: { userId: target.id } });
    await tx.recipe.updateMany({ where: { userId: DEV_ID }, data: { userId: target.id } });
    await tx.apiKey.updateMany({ where: { userId: DEV_ID }, data: { userId: target.id } });

    // Groupes : transfert de propriete.
    await tx.group.updateMany({ where: { ownerId: DEV_ID }, data: { ownerId: target.id } });

    // GroupMember : @@unique([groupId, userId]) -> eviter les doublons.
    const devMemberships = await tx.groupMember.findMany({ where: { userId: DEV_ID } });
    for (const m of devMemberships) {
      const exists = await tx.groupMember.findFirst({ where: { groupId: m.groupId, userId: target.id } });
      if (exists) {
        if (m.role === "admin" && exists.role !== "admin") {
          await tx.groupMember.update({ where: { id: exists.id }, data: { role: "admin" } });
        }
        await tx.groupMember.delete({ where: { id: m.id } });
      } else {
        await tx.groupMember.update({ where: { id: m.id }, data: { userId: target.id } });
      }
    }

    // KidDayEntry : @@unique([userId, date]).
    const devKids = await tx.kidDayEntry.findMany({ where: { userId: DEV_ID } });
    for (const k of devKids) {
      const exists = await tx.kidDayEntry.findFirst({ where: { userId: target.id, date: k.date } });
      if (exists) await tx.kidDayEntry.delete({ where: { id: k.id } });
      else await tx.kidDayEntry.update({ where: { id: k.id }, data: { userId: target.id } });
    }

    // UserFeatureFlag : @@unique([userId, feature]).
    const devFlags = await tx.userFeatureFlag.findMany({ where: { userId: DEV_ID } });
    for (const f of devFlags) {
      const exists = await tx.userFeatureFlag.findFirst({ where: { userId: target.id, feature: f.feature } });
      if (exists) await tx.userFeatureFlag.delete({ where: { id: f.id } });
      else await tx.userFeatureFlag.update({ where: { id: f.id }, data: { userId: target.id } });
    }
  });

  console.log(`[reassign] cible (${target.email}) apres :`, JSON.stringify(await counts(target.id)));
  console.log(`[reassign] dev-user apres :`, JSON.stringify(await counts(DEV_ID)));
  console.log("[reassign] === TERMINE avec succes ===");
}

main()
  .catch((e) => {
    console.error("[reassign] ERREUR :", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
