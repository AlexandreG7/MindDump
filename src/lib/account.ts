import { unlink } from "fs/promises";
import { prisma } from "./prisma";
import { resolveUploadPaths } from "./uploads";
import { revokeAppleToken } from "./authProviders";
import { loadReadableContext, lockProfile } from "./kidTrackers";

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
      dashboardLayout: true,
      createdAt: true,
      lastLoginAt: true,
      consentedAt: true,
      consentVersion: true,
      notifyEmail: true,
      password: true,
      calendarToken: true,
      accounts: { select: { provider: true, type: true } },
      featureFlags: { select: { feature: true, enabled: true } },
      apiKeys: { select: { name: true, createdAt: true } },
      loginEvents: { select: { createdAt: true, provider: true }, orderBy: { createdAt: "asc" } },
      // Appareils abonnés aux notifications. L'endpoint et les clés sont des
      // secrets d'envoi, pas des informations sur l'utilisateur : non exportés.
      pushSubscriptions: { select: { userAgent: true, createdAt: true, lastUsedAt: true } },
      // Journal des imports IA (quota) : ni document ni résultat n'y sont gardés.
      aiImports: { select: { source: true, inputTokens: true, outputTokens: true, createdAt: true } },
      groupMemberships: {
        select: {
          role: true,
          joinedAt: true,
          group: {
            select: {
              id: true, name: true, isDefault: true, ownerId: true,
              // Produits de drive retenus par le foyer (données du groupe).
              driveProducts: {
                select: {
                  store: true, name: true, sku: true, label: true, brand: true, quantity: true,
                  useCount: true, lastUsedAt: true, createdAt: true,
                },
              },
            },
          },
        },
      },
      todos: {
        select: {
          id: true, title: true, description: true, priority: true, dueDate: true,
          completed: true, recurrence: true, notifyBefore: true, createdAt: true,
          updatedAt: true, groupId: true,
          assignees: { select: { profile: { select: { id: true, name: true } } } },
        },
      },
      calendarEvents: {
        select: {
          id: true, title: true, description: true, date: true, endDate: true,
          allDay: true, recurrence: true, color: true, notifyBefore: true,
          createdAt: true, updatedAt: true, groupId: true,
          assignees: { select: { profile: { select: { id: true, name: true } } } },
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
      recipeFavorites: { select: { recipeId: true, createdAt: true } },
      mealPlanEntries: {
        select: { date: true, slot: true, note: true, servings: true, groupId: true, createdAt: true, recipe: { select: { id: true, title: true } } },
      },
      wallDevices: {
        select: { id: true, name: true, groupId: true, createdAt: true, lastSeenAt: true },
      },
      familyProfiles: {
        select: { id: true, groupId: true, name: true, kind: true, color: true, emoji: true, birthDate: true },
      },
      kidTrackersCreated: { select: { profileId: true } },
    },
  });
  if (!user) return null;

  const { password, calendarToken, recipes, kidTrackersCreated, ...rest } = user;

  // Semainier : les lignes dont la personne est l'AUTEUR (la première saisie du jour crée la
  // ligne à son nom) avec leurs valeurs en clair, et les rubriques des enfants concernés
  // (saisies ou créées par elle). Lecture seule : un export n'écrit jamais en base, donc les
  // lignes pas encore reprises sont lues depuis les anciennes colonnes (loadReadableContext).
  // Limite assumée : pas d'attribution par champ. La ligne d'un jour est un seul objet
  // JSON, sans auteur par rubrique : elle contient aussi ce que d'autres parents y ont
  // ajouté, et ce que la personne a ajouté à une ligne ouverte par un autre n'est pas exporté
  // ici (ça figure dans l'export de l'auteur de la ligne). Voir docs/rgpd.md.
  const entryProfiles = await prisma.kidDayEntry.findMany({
    where: { userId, profileId: { not: null } },
    select: { profileId: true },
    distinct: ["profileId"],
  });
  const kidProfileIds = Array.from(
    new Set([
      ...entryProfiles.flatMap((e) => (e.profileId ? [e.profileId] : [])),
      ...kidTrackersCreated.map((t) => t.profileId),
    ])
  );
  const readableContext = await loadReadableContext(kidProfileIds);
  const kidTrackers = kidProfileIds.flatMap((id) => readableContext.trackers(id)).map((t) => ({
    id: t.id,
    profileId: t.profileId,
    label: t.label,
    icon: t.icon,
    kind: t.kind,
    active: t.active,
    options: t.options.map((o) => ({ id: o.id, label: o.label, icon: o.icon, active: o.active })),
  }));
  const kidDayEntries = (
    await prisma.kidDayEntry.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: {
        date: true, weather: true, mood: true, nap: true, accident: true, activities: true,
        values: true, createdAt: true, updatedAt: true,
        profile: { select: { id: true, name: true, groupId: true } },
      },
    })
  ).map((e) => ({
    ...e,
    readableValues: e.profile ? readableContext.readable(e.profile.id, e) : {},
  }));
  // Sans relation vers User (voir schema.prisma) : lus à part.
  const mobileDevices = await prisma.mobileDevice.findMany({
    where: { userId },
    select: { name: true, platform: true, createdAt: true, lastSeenAt: true },
  });
  return {
    exportedAt: new Date().toISOString(),
    format: "MindDump export v1",
    user: {
      ...rest,
      hasPassword: !!password,
      hasCalendarFeed: !!calendarToken,
      mobileDevices,
      kidTrackers,
      kidDayEntries,
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
 *   continue d'exister (todos, événements, listes, recettes, repas prévus) :
 *     true  -> ces éléments passent au propriétaire du groupe, rien ne disparaît
 *              pour les autres membres ;
 *     false -> ils sont supprimés avec le reste.
 *   Les abonnements calendrier (URL ICS, souvent porteuses d'un jeton privé) sont
 *   toujours supprimés.
 * - Le semainier d'un enfant du groupe ne suit PAS keepShared (ADR 0002) : une ligne
 *   de jour appartient à son premier auteur mais d'autres parents la complètent, la
 *   supprimer ferait disparaître le jour de l'enfant pour tout le foyer. Quand le
 *   groupe survit, les saisies passent toujours à son propriétaire ; quand il
 *   disparaît, elles partent avec lui. Seules les lignes rangées sur le profil
 *   personnel de la personne (profil adulte, retiré avec son compte) disparaissent.
 * - Verrous : pour ne pas se croiser avec l'API du semainier (verrou consultatif du
 *   profil, puis lignes), on prend d'abord les verrous consultatifs des profils concernés
 *   dans l'ordre des id, puis les lignes de la personne par ORDER BY id FOR UPDATE.
 * - Tout le reste part en cascade depuis User (éléments personnels, adhésions
 *   et profils de membre, clés API, préférences, historique de connexion,
 *   comptes OAuth).
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
    // Semainier : mêmes verrous que l'API, dans le même ordre (profils par id, puis lignes
    // par id), avant toute écriture. Évite un interblocage (40P01) avec une saisie ou une
    // reprise en cours sur un enfant que la personne a rempli ou dont elle a créé une rubrique.
    const touchedProfiles = new Set<string>();
    (await tx.kidDayEntry.findMany({ where: { userId, profileId: { not: null } }, select: { profileId: true }, distinct: ["profileId"] }))
      .forEach((e) => e.profileId && touchedProfiles.add(e.profileId));
    (await tx.kidTracker.findMany({ where: { createdById: userId }, select: { profileId: true }, distinct: ["profileId"] }))
      .forEach((t) => touchedProfiles.add(t.profileId));
    for (const profileId of Array.from(touchedProfiles).sort()) await lockProfile(tx, profileId);
    await tx.$queryRaw`SELECT id FROM "KidDayEntry" WHERE "userId" = ${userId} ORDER BY id FOR UPDATE`;

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
      collect(await tx.mealPlanEntry.findMany({ where: inGroup, select: { groupId: true }, distinct: ["groupId"] }));

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
        await tx.mealPlanEntry.updateMany({ where, data });
      }
    }

    // Semainier, quel que soit keepShared : les saisies passent au propriétaire du groupe qui
    // survit (ADR 0002). Un groupe supprimé plus haut a déjà emporté ses profils et leurs lignes.
    const kidGroups = await tx.kidDayEntry.findMany({
      where: { userId, profileId: { not: null } },
      select: { profile: { select: { groupId: true, group: { select: { ownerId: true } } } } },
      distinct: ["profileId"],
    });
    const kidOwners = new Map<string, string>();
    for (const e of kidGroups) if (e.profile) kidOwners.set(e.profile.groupId, e.profile.group.ownerId);
    for (const [groupId, ownerId] of Array.from(kidOwners)) {
      if (ownerId === userId) continue; // ne peut pas arriver : ses groupes ont déjà un nouvel héritier ou ont disparu
      await tx.kidDayEntry.updateMany({ where: { userId, profile: { groupId } }, data: { userId: ownerId } });
    }

    if (user.email) {
      await tx.verificationToken.deleteMany({ where: { identifier: user.email } });
      // Bêta privée : demande d'accès et invitations de cette adresse (sans relation
      // vers User, comme les jetons ci-dessus), quelle que soit la casse enregistrée.
      const betaEmail = { equals: user.email, mode: "insensitive" as const };
      await tx.signupInvite.deleteMany({ where: { email: betaEmail } });
      await tx.betaAccessRequest.deleteMany({ where: { email: betaEmail } });
      // Adresse autorisée à s'inscrire sans lien (gérée dans /admin) : retirée avec le compte.
      await tx.allowedSignupEmail.deleteMany({ where: { email: betaEmail } });
    }
    // Sans relation vers User (voir schema.prisma) : à effacer explicitement.
    await tx.mobileDevice.deleteMany({ where: { userId } });
    await tx.mobileAuthCode.deleteMany({ where: { userId } });
    await tx.mobileLinkTicket.deleteMany({ where: { userId } });
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
