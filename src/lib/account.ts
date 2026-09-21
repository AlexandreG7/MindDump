import { unlink } from "fs/promises";
import { prisma } from "./prisma";
import { resolveUploadPaths } from "./uploads";
import { revokeAppleToken } from "./authProviders";

// Mot à taper pour confirmer la suppression du compte (UI et API).
export const DELETE_CONFIRMATION = "SUPPRIMER";

/**
 * Droit à la portabilité (art. 20 RGPD) : toutes les données fournies par la
 * personne ou produites par son usage, dans un format structuré (JSON).
 *
 * Sont volontairement exclus : le hash du mot de passe, les jetons OAuth Google,
 * le jeton du flux calendrier et la valeur des clés API (secrets, pas des
 * données personnelles utiles à la personne).
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      weatherLat: true,
      weatherLon: true,
      weatherCity: true,
      createdAt: true,
      lastLoginAt: true,
      consentedAt: true,
      consentVersion: true,
      password: true,
      calendarToken: true,
      accounts: { select: { provider: true, type: true } },
      featureFlags: { select: { feature: true, enabled: true } },
      apiKeys: { select: { name: true, createdAt: true } },
      loginEvents: { select: { createdAt: true, provider: true }, orderBy: { createdAt: "asc" } },
      groupMemberships: {
        select: {
          role: true,
          joinedAt: true,
          group: { select: { id: true, name: true, isDefault: true, ownerId: true } },
        },
      },
      todos: {
        select: {
          id: true, title: true, description: true, priority: true, dueDate: true,
          completed: true, recurrence: true, notifyBefore: true, createdAt: true,
          updatedAt: true, groupId: true,
        },
      },
      calendarEvents: {
        select: {
          id: true, title: true, description: true, date: true, endDate: true,
          allDay: true, recurrence: true, color: true, notifyBefore: true,
          createdAt: true, updatedAt: true, groupId: true,
        },
      },
      calendarSubscriptions: {
        select: { id: true, name: true, url: true, color: true, enabled: true, createdAt: true, groupId: true },
      },
      shoppingLists: {
        select: {
          id: true, name: true, type: true, createdAt: true, updatedAt: true, groupId: true,
          items: {
            select: { name: true, quantity: true, checked: true, category: true, url: true, price: true, store: true },
          },
        },
      },
      recipes: {
        select: {
          id: true, title: true, description: true, servings: true, prepTime: true,
          cookTime: true, steps: true, image: true, planned: true, inCatalog: true,
          createdAt: true, updatedAt: true, groupId: true,
          ingredients: { select: { name: true, quantity: true, unit: true } },
        },
      },
      kidDayEntries: {
        select: {
          date: true, weather: true, mood: true, nap: true, accident: true,
          activities: true, createdAt: true, updatedAt: true,
        },
      },
    },
  });
  if (!user) return null;

  const { password, calendarToken, recipes, ...rest } = user;
  return {
    exportedAt: new Date().toISOString(),
    format: "MindDump export v1",
    user: {
      ...rest,
      hasPassword: !!password,
      hasCalendarFeed: !!calendarToken,
      recipes: recipes.map((r) => ({
        ...r,
        steps: parseJson(r.steps),
      })),
    },
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Droit à l'effacement (art. 17 RGPD). Supprime le compte et tout ce qui en
 * dépend, sans laisser de ligne orpheline ni casser un groupe encore utilisé :
 *
 * - Groupes possédés (la relation GroupOwner n'a pas de cascade, la base
 *   refuserait la suppression) : s'il reste des membres, le groupe passe au plus
 *   ancien admin, à défaut au plus ancien membre, y compris le groupe par défaut
 *   (qui devient un groupe ordinaire chez son nouveau propriétaire) ; sinon il
 *   est supprimé. Les éléments des autres membres ne sont jamais touchés.
 * - keepShared = choix de la personne pour ce qu'ELLE a rangé dans un groupe qui
 *   continue d'exister (todos, événements, listes, recettes) :
 *     true  -> ces éléments passent au propriétaire du groupe, rien ne disparaît
 *              pour les autres membres ;
 *     false -> ils sont supprimés avec le reste.
 *   Les abonnements calendrier (URL ICS, souvent porteuses d'un jeton privé) et
 *   le semainier sont toujours supprimés.
 * - Tout le reste part en cascade depuis User (éléments personnels, adhésions,
 *   clés API, préférences, semainier, historique de connexion, comptes OAuth).
 * - Les jetons de vérification liés à l'email et les photos de recettes
 *   supprimées sont effacés à part (pas de relation en base), et les jetons
 *   Apple sont révoqués auprès d'Apple.
 */
export async function deleteUserAccount(userId: string, { keepShared }: { keepShared: boolean }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      recipes: { where: { image: { startsWith: "/uploads/" } }, select: { image: true } },
      accounts: { where: { provider: "apple" }, select: { refresh_token: true } },
    },
  });
  if (!user) return false;

  await prisma.$transaction(async (tx) => {
    const ownedGroups = await tx.group.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        isDefault: true,
        members: {
          where: { userId: { not: userId } },
          orderBy: { joinedAt: "asc" },
          select: { userId: true, role: true },
        },
      },
    });

    for (const group of ownedGroups) {
      const heir = group.members.find((m) => m.role === "admin") ?? group.members[0];
      if (!heir) {
        // Personne d'autre : le groupe disparaît, ses éléments (tous à cette
        // personne) redeviennent personnels puis partent avec le compte.
        await tx.group.delete({ where: { id: group.id } });
        continue;
      }
      // Le nouveau propriétaire a déjà son propre groupe par défaut.
      await tx.group.update({
        where: { id: group.id },
        data: { ownerId: heir.userId, isDefault: false },
      });
      await tx.groupMember.update({
        where: { groupId_userId: { groupId: group.id, userId: heir.userId } },
        data: { role: "admin" },
      });
    }

    if (keepShared) {
      // Groupes restants où la personne a rangé des éléments : elle n'en possède
      // plus aucun à ce stade, chacun a donc un autre propriétaire.
      const inGroup = { userId, groupId: { not: null } };
      const groupIds = new Set<string>();
      const collect = (rows: { groupId: string | null }[]) =>
        rows.forEach((r) => r.groupId && groupIds.add(r.groupId));
      collect(await tx.todo.findMany({ where: inGroup, select: { groupId: true }, distinct: ["groupId"] }));
      collect(await tx.calendarEvent.findMany({ where: inGroup, select: { groupId: true }, distinct: ["groupId"] }));
      collect(await tx.shoppingList.findMany({ where: inGroup, select: { groupId: true }, distinct: ["groupId"] }));
      collect(await tx.recipe.findMany({ where: inGroup, select: { groupId: true }, distinct: ["groupId"] }));

      const groups = await tx.group.findMany({
        where: { id: { in: Array.from(groupIds) } },
        select: { id: true, ownerId: true },
      });
      for (const g of groups) {
        const where = { userId, groupId: g.id };
        const data = { userId: g.ownerId };
        await tx.todo.updateMany({ where, data });
        await tx.calendarEvent.updateMany({ where, data });
        await tx.shoppingList.updateMany({ where, data });
        await tx.recipe.updateMany({ where, data });
      }
    }

    if (user.email) {
      await tx.verificationToken.deleteMany({ where: { identifier: user.email } });
    }
    await tx.user.delete({ where: { id: userId } });
  });

  // Apple demande de révoquer ses jetons quand le compte est supprimé.
  for (const account of user.accounts) await revokeAppleToken(account.refresh_token);

  // Fichiers : après la transaction, et seulement s'ils ne sont plus référencés
  // (une copie de recette partagée a normalement son propre fichier).
  for (const { image } of user.recipes) {
    if (!image) continue;
    const stillUsed = await prisma.recipe.count({ where: { image } });
    if (stillUsed > 0) continue;
    for (const filePath of resolveUploadPaths(image)) {
      await unlink(filePath).catch(() => {});
    }
  }

  return true;
}
