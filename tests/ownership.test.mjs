/**
 * Test de non-régression : un élément reste TOUJOURS visible par son auteur
 * (docs/adr/0001-les-elements-restent-attaches-a-leur-auteur.md).
 *
 * Bout en bout, par HTTP, contre un serveur MindDump lancé sur une base JETABLE :
 * on joue ce que vit l'utilisateur (retrait d'un groupe, groupe supprimé, profils
 * du foyer synchronisés…) et on vérifie, à chaque étape, ce que l'interface
 * affiche (liste filtrée par le groupe courant, liste sans filtre, fiche).
 *
 * Exécuté à chaque déploiement (stage « test » du Dockerfile, voir
 * scripts/test-ownership.sh). En local : npm run test:ownership.
 *
 * Variables : BASE_URL (serveur), DATABASE_URL (base jetable, JAMAIS la prod).
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
if (process.env.OWNERSHIP_TEST_DB !== "disposable") {
  console.error("Refus : OWNERSHIP_TEST_DB=disposable requis (ce test écrit dans la base).");
  process.exit(2);
}

const prisma = new PrismaClient();
const run = randomBytes(4).toString("hex");
let failures = 0;
let checks = 0;

function check(cond, label) {
  checks++;
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

async function makeUser(name) {
  const key = `test-${run}-${name}-${randomBytes(8).toString("hex")}`;
  const user = await prisma.user.create({
    data: {
      name,
      email: `${name}-${run}@test.local`,
      consentedAt: new Date(),
      apiKeys: { create: { key } },
    },
  });
  const group = await prisma.group.create({
    data: {
      name: `Groupe de ${name}`,
      isDefault: true,
      ownerId: user.id,
      members: { create: { userId: user.id, role: "admin" } },
    },
  });
  return { id: user.id, key, defaultGroupId: group.id, name };
}

async function api(user, method, path, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: { authorization: `Bearer ${user.key}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* corps non JSON */ }
  return { status: res.status, json };
}

// Crée un élément de chaque type dans un groupe, renvoie leurs ids.
async function createAll(user, groupId, label) {
  const recipe = await api(user, "POST", "/api/recipes", { title: `Recette ${label}`, groupId, steps: [] });
  const todo = await api(user, "POST", "/api/todos", { title: `Tâche ${label}`, groupId });
  const list = await api(user, "POST", "/api/lists", { name: `Liste ${label}`, groupId });
  const event = await api(user, "POST", "/api/calendar", {
    title: `Événement ${label}`, groupId, date: new Date().toISOString(),
  });
  for (const [kind, r] of Object.entries({ recipe, todo, list, event })) {
    if (!r.json?.id) throw new Error(`Création ${kind} ${label} impossible (${r.status})`);
  }
  return { recipe: recipe.json.id, todo: todo.json.id, list: list.json.id, event: event.json.id };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const now = new Date();
const RESOURCES = {
  recipe: { list: "/api/recipes", item: (id) => `/api/recipes/${id}` },
  // Seules les recettes ont une fiche (GET /api/xxx/[id]).
  todo: { list: "/api/todos" },
  list: { list: "/api/lists" },
  // Vue mensuelle, celle du calendrier de l'interface.
  event: {
    list: `/api/calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
  },
};

async function listIds(user, kind, groupId) {
  const base = RESOURCES[kind].list;
  const sep = base.includes("?") ? "&" : "?";
  const r = await api(user, "GET", groupId ? `${base}${sep}groupId=${groupId}` : base);
  if (!Array.isArray(r.json)) throw new Error(`GET ${base} → ${r.status}`);
  return new Set(r.json.map((x) => x.id));
}

/** L'auteur voit ses éléments partout où l'interface peut les chercher. */
async function expectVisible(user, items, currentGroupId, context) {
  for (const [kind, id] of Object.entries(items)) {
    check((await listIds(user, kind, currentGroupId)).has(id), `${context} : ${user.name} voit son ${kind} dans la vue du groupe courant`);
    check((await listIds(user, kind, null)).has(id), `${context} : ${user.name} voit son ${kind} sans filtre de groupe`);
    if (!RESOURCES[kind].item) continue;
    const r = await api(user, "GET", RESOURCES[kind].item(id));
    check(r.status === 200, `${context} : ${user.name} ouvre son ${kind} (${r.status})`);
  }
}

/** Personne d'autre que l'auteur et les membres du groupe ne le voit. */
async function expectHidden(user, items, context) {
  for (const [kind, id] of Object.entries(items)) {
    check(!(await listIds(user, kind, null)).has(id), `${context} : ${user.name} ne voit pas le ${kind}`);
    check(!(await listIds(user, kind, user.defaultGroupId)).has(id), `${context} : ${user.name} ne voit pas le ${kind} dans son groupe`);
    if (!RESOURCES[kind].item) continue;
    const r = await api(user, "GET", RESOURCES[kind].item(id));
    check(r.status === 404 || r.status === 403, `${context} : ${user.name} ne peut pas ouvrir le ${kind} (${r.status})`);
  }
}

async function main() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const carol = await makeUser("carol");

  // Bob rejoint le foyer d'Alice et y crée des éléments.
  await prisma.groupMember.create({ data: { groupId: alice.defaultGroupId, userId: bob.id } });
  const aliceItems = await createAll(alice, alice.defaultGroupId, "alice");
  const bobInAlice = await createAll(bob, alice.defaultGroupId, "bob-chez-alice");

  console.log("1. Situation de départ");
  await expectVisible(alice, aliceItems, alice.defaultGroupId, "départ");
  await expectVisible(bob, bobInAlice, alice.defaultGroupId, "départ");
  await expectVisible(alice, bobInAlice, alice.defaultGroupId, "départ (partage au foyer)");
  await expectHidden(carol, aliceItems, "départ");

  console.log("1b. Listes de courses partagées avec le foyer");
  // « Recette → liste » sans liste choisie : la nouvelle liste suit le groupe de la recette.
  const toList = await api(bob, "POST", `/api/recipes/${bobInAlice.recipe}/to-list`, {});
  check(!!toList.json?.listId, `recette de Bob → nouvelle liste (${toList.status})`);
  check((await listIds(alice, "list", alice.defaultGroupId)).has(toList.json?.listId), "alice voit la liste créée depuis la recette de Bob");
  check(!(await listIds(carol, "list", null)).has(toList.json?.listId), "carol ne voit pas cette liste");
  // Ajouter à une liste inaccessible : refusé.
  const carolList = await api(carol, "POST", "/api/lists", { name: `Liste carol ${run}` });
  const intrusion = await api(bob, "POST", `/api/recipes/${bobInAlice.recipe}/to-list`, { listId: carolList.json.id });
  check(intrusion.status === 404, `bob ne peut pas remplir la liste de carol (${intrusion.status})`);
  const carolItems = await prisma.shoppingItem.count({ where: { listId: carolList.json.id } });
  check(carolItems === 0, "la liste de carol est restée vide");

  console.log("2. Synchronisation des profils du foyer (lecture de /profiles)");
  const profiles = await api(alice, "GET", `/api/groups/${alice.defaultGroupId}/profiles`);
  check(profiles.status === 200, `profils du foyer lus (${profiles.status})`);
  await expectVisible(alice, aliceItems, alice.defaultGroupId, "après profils");
  await expectVisible(bob, bobInAlice, alice.defaultGroupId, "après profils");

  console.log("3. Bob est retiré du foyer d'Alice");
  const removed = await api(alice, "DELETE", `/api/groups/${alice.defaultGroupId}/members/${bob.id}`);
  check(removed.status === 200, `retrait de Bob (${removed.status})`);
  await expectVisible(bob, bobInAlice, bob.defaultGroupId, "après retrait");
  await expectVisible(alice, bobInAlice, alice.defaultGroupId, "après retrait (reste au foyer)");
  await expectVisible(alice, aliceItems, alice.defaultGroupId, "après retrait");
  await expectHidden(bob, aliceItems, "après retrait");

  console.log("4. Alice supprime un groupe qui contient ses éléments");
  const extra = await api(alice, "POST", "/api/groups", { name: `Temporaire ${run}` });
  check(!!extra.json?.id, `groupe temporaire créé (${extra.status})`);
  const inExtra = await createAll(alice, extra.json.id, "groupe-supprimé");
  const deleted = await api(alice, "DELETE", `/api/groups/${extra.json.id}`);
  check(deleted.status === 200, `groupe supprimé (${deleted.status})`);
  await expectVisible(alice, inExtra, alice.defaultGroupId, "après suppression du groupe");
  await expectHidden(carol, inExtra, "après suppression du groupe");
  await expectHidden(bob, inExtra, "après suppression du groupe");

  console.log("5. Bob quitte lui-même un groupe");
  const shared = await api(carol, "POST", "/api/groups", { name: `Partagé ${run}` });
  await prisma.groupMember.create({ data: { groupId: shared.json.id, userId: bob.id } });
  const bobInShared = await createAll(bob, shared.json.id, "bob-chez-carol");
  const left = await api(bob, "DELETE", `/api/groups/${shared.json.id}/members/${bob.id}`);
  check(left.status === 200, `Bob quitte le groupe (${left.status})`);
  await expectVisible(bob, bobInShared, bob.defaultGroupId, "après départ");
  await expectVisible(carol, bobInShared, shared.json.id, "après départ (reste au groupe)");

  console.log("6. Un admin (non propriétaire) retire un membre simple");
  const dave = await makeUser("dave");
  const eve = await makeUser("eve");
  const frank = await makeUser("frank");
  // Dave est admin du foyer d'Alice, Eve et Frank y sont membres simples.
  await prisma.groupMember.create({ data: { groupId: alice.defaultGroupId, userId: dave.id, role: "admin" } });
  await prisma.groupMember.create({ data: { groupId: alice.defaultGroupId, userId: eve.id, role: "member" } });
  await prisma.groupMember.create({ data: { groupId: alice.defaultGroupId, userId: frank.id, role: "member" } });
  const eveInAlice = await createAll(eve, alice.defaultGroupId, "eve-chez-alice");

  const adminRemovesMember = await api(dave, "DELETE", `/api/groups/${alice.defaultGroupId}/members/${eve.id}`);
  check(adminRemovesMember.status === 200, `un admin retire un membre simple (${adminRemovesMember.status})`);
  await expectVisible(eve, eveInAlice, eve.defaultGroupId, "retirée par un admin");
  await expectVisible(alice, eveInAlice, alice.defaultGroupId, "retirée par un admin (reste au foyer)");

  console.log("7. Un admin ne peut retirer ni un autre admin, ni le propriétaire");
  // Promouvons Frank admin pour tester le cas « admin retire un autre admin ».
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId: alice.defaultGroupId, userId: frank.id } },
    data: { role: "admin" },
  });
  const adminRemovesOtherAdmin = await api(dave, "DELETE", `/api/groups/${alice.defaultGroupId}/members/${frank.id}`);
  check(adminRemovesOtherAdmin.status === 403, `un admin ne peut pas retirer un autre admin (${adminRemovesOtherAdmin.status})`);
  const adminRemovesOwner = await api(dave, "DELETE", `/api/groups/${alice.defaultGroupId}/members/${alice.id}`);
  check(adminRemovesOwner.status === 400, `un admin ne peut pas retirer le propriétaire (${adminRemovesOwner.status})`);

  console.log("8. Un membre simple ne peut pas retirer un autre membre");
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId: alice.defaultGroupId, userId: frank.id } },
    data: { role: "member" },
  });
  const grace = await makeUser("grace");
  await prisma.groupMember.create({ data: { groupId: alice.defaultGroupId, userId: grace.id, role: "member" } });
  const memberRemovesMember = await api(frank, "DELETE", `/api/groups/${alice.defaultGroupId}/members/${grace.id}`);
  check(memberRemovesMember.status === 403, `un membre simple ne peut pas retirer un autre membre (${memberRemovesMember.status})`);

  console.log("9. Résumé des recettes (?fields=summary, utilisé par la page Listes)");
  const summaryRecipe = await api(alice, "POST", "/api/recipes", {
    title: `Recette résumé ${run}`,
    groupId: alice.defaultGroupId,
    steps: [],
    ingredients: [
      { name: "Sel", quantity: "1", unit: "pincée" },
      { name: "Poivre", quantity: "1", unit: "pincée" },
    ],
  });
  check(!!summaryRecipe.json?.id, `recette avec ingrédients créée (${summaryRecipe.status})`);
  const summaryId = summaryRecipe.json.id;

  const aliceSummary = await api(alice, "GET", `/api/recipes?fields=summary&groupId=${alice.defaultGroupId}`);
  const aliceEntry = (aliceSummary.json || []).find((r) => r.id === summaryId);
  check(!!aliceEntry, `alice voit sa recette dans le résumé (${aliceSummary.status})`);
  check(
    !!aliceEntry && Object.keys(aliceEntry).sort().join(",") === "id,ingredientCount,title",
    "le résumé ne contient que id, title et ingredientCount"
  );
  check(aliceEntry?.ingredientCount === 2, "le résumé compte les ingrédients");

  const carolSummaryNoFilter = await api(carol, "GET", "/api/recipes?fields=summary");
  check(
    !(carolSummaryNoFilter.json || []).some((r) => r.id === summaryId),
    "carol (non membre) ne voit pas la recette d'alice dans le résumé, sans filtre de groupe"
  );
  const carolSummaryGroupFilter = await api(carol, "GET", `/api/recipes?fields=summary&groupId=${alice.defaultGroupId}`);
  check(
    carolSummaryGroupFilter.status === 403,
    `carol ne peut pas filtrer le résumé sur un groupe dont elle n'est pas membre (${carolSummaryGroupFilter.status})`
  );

  console.log("10. Inscription par invitation de foyer, adhésion, puis départ du groupe");
  // Inscriptions fermées (aucune liste blanche sur ce serveur) : seul un lien de foyer NOMINATIF
  // ouvre l'inscription, pour son adresse (src/lib/groupInviteSignup.ts). L'adhésion suit le flux
  // existant (rôle « member »).
  {
    const token = randomBytes(24).toString("base64url");
    const addr = `hugo-${run}@test.local`;
    await prisma.groupInvite.create({
      data: { groupId: alice.defaultGroupId, token, email: addr, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    const openToken = randomBytes(24).toString("base64url");
    await prisma.groupInvite.create({
      data: { groupId: alice.defaultGroupId, token: openToken, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    const openTry = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Hugo", email: addr, password: "motdepasse-solide", consent: true, groupInvite: openToken }),
    });
    check(openTry.status === 403, `un lien de foyer ouvert ne permet pas de s'inscrire (${openTry.status})`);
    const closed = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Hugo", email: addr, password: "motdepasse-solide", consent: true }),
    });
    check(closed.status === 403, `sans lien de foyer, l'inscription reste fermée (${closed.status})`);
    const signup = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Hugo", email: addr, password: "motdepasse-solide", consent: true, groupInvite: token }),
    });
    check(signup.status === 201, `inscription avec le lien de foyer (${signup.status})`);
    const row = await prisma.user.findUnique({ where: { email: addr } });
    const hugoKey = `test-${run}-hugo-${randomBytes(8).toString("hex")}`;
    await prisma.apiKey.create({ data: { key: hugoKey, userId: row.id } });
    const hugoGroup = await prisma.group.findFirst({ where: { ownerId: row.id, isDefault: true } });
    const hugo = { id: row.id, key: hugoKey, defaultGroupId: hugoGroup.id, name: "hugo" };
    const joined = await api(hugo, "POST", `/api/groups/join/${token}`);
    check(joined.status === 200, `Hugo rejoint le foyer d'Alice par la page du groupe (${joined.status})`);
    const membership = await prisma.groupMember.findFirst({ where: { groupId: alice.defaultGroupId, userId: hugo.id } });
    check(membership?.role === "member", "Hugo est membre simple (aucun droit d'admin)");
    const denied = await api(hugo, "POST", `/api/groups/${alice.defaultGroupId}/invite`, {});
    check(denied.status === 403, `un membre simple ne peut pas inviter à son tour (${denied.status})`);
    const seen = await api(hugo, "GET", `/api/groups/${alice.defaultGroupId}/invite`);
    check(seen.status === 200 && Array.isArray(seen.json) && seen.json.every((i) => i.token === undefined && i.joinUrl === undefined), "un membre simple ne voit aucun jeton de lien d'invitation");
    const adminSeen = await api(alice, "GET", `/api/groups/${alice.defaultGroupId}/invite`);
    check(adminSeen.status === 200 && adminSeen.json.some((i) => typeof i.token === "string"), "le propriétaire voit les liens en attente");
    const hugoItems = await createAll(hugo, alice.defaultGroupId, "hugo-chez-alice");
    await expectVisible(alice, hugoItems, alice.defaultGroupId, "inscrit par lien de foyer (partage au foyer)");
    await expectVisible(hugo, aliceItems, alice.defaultGroupId, "inscrit par lien de foyer (éléments du foyer)");
    await expectHidden(carol, hugoItems, "inscrit par lien de foyer");
    const leftHome = await api(hugo, "DELETE", `/api/groups/${alice.defaultGroupId}/members/${hugo.id}`);
    check(leftHome.status === 200, `Hugo quitte le foyer (${leftHome.status})`);
    await expectVisible(hugo, hugoItems, hugo.defaultGroupId, "après départ du foyer");
    await expectVisible(alice, hugoItems, alice.defaultGroupId, "après départ de Hugo (reste au foyer)");
    await expectHidden(hugo, aliceItems, "après départ du foyer");
  }
  console.log("11. Déplacer un élément vers un foyer dont on n'est pas membre");
  // Carol n'est pas membre du foyer d'Alice (ni d'aucun groupe de Bob) : elle ne
  // peut y déplacer ni y créer quoi que ce soit, et ses éléments ne bougent pas.
  const foreign = alice.defaultGroupId;
  const gidOf = {
    recipe: async (id) => (await prisma.recipe.findUnique({ where: { id }, select: { groupId: true } }))?.groupId,
    todo: async (id) => (await prisma.todo.findUnique({ where: { id }, select: { groupId: true } }))?.groupId,
    list: async (id) => (await prisma.shoppingList.findUnique({ where: { id }, select: { groupId: true } }))?.groupId,
    event: async (id) => (await prisma.calendarEvent.findUnique({ where: { id }, select: { groupId: true } }))?.groupId,
  };
  const carolItems2 = await createAll(carol, carol.defaultGroupId, "carol-déplacement");

  const moveRecipe = await api(carol, "PATCH", `/api/recipes/${carolItems2.recipe}`, { groupId: foreign });
  check(moveRecipe.status === 403, `PATCH recette vers un foyer étranger refusé (${moveRecipe.status})`);
  check((await gidOf.recipe(carolItems2.recipe)) === carol.defaultGroupId, "la recette n'a pas bougé");
  // Aucune autre écriture du même PATCH n'est appliquée quand le déplacement est refusé.
  const moveWithTitle = await api(carol, "PATCH", `/api/recipes/${carolItems2.recipe}`, {
    groupId: foreign, title: `Piratée ${run}`, ingredients: [{ name: "Sel", quantity: "1" }],
  });
  check(moveWithTitle.status === 403, `PATCH recette (titre + ingrédients + foyer étranger) refusé (${moveWithTitle.status})`);
  const afterRefusal = await prisma.recipe.findUnique({
    where: { id: carolItems2.recipe }, select: { title: true, _count: { select: { ingredients: true } } },
  });
  check(afterRefusal.title !== `Piratée ${run}` && afterRefusal._count.ingredients === 0, "refus atomique : ni titre ni ingrédients modifiés");
  const moveBogus = await api(carol, "PATCH", `/api/recipes/${carolItems2.recipe}`, { groupId: { id: foreign } });
  check(moveBogus.status === 400, `groupId qui n'est pas une chaîne refusé (${moveBogus.status})`);
  check((await gidOf.recipe(carolItems2.recipe)) === carol.defaultGroupId, "la recette n'a toujours pas bougé");

  // Tâche et événement : le groupId d'un PATCH est ignoré, jamais appliqué.
  await api(carol, "PATCH", `/api/todos/${carolItems2.todo}`, { groupId: foreign });
  check((await gidOf.todo(carolItems2.todo)) === carol.defaultGroupId, "la tâche n'a pas bougé (PATCH avec groupId étranger)");
  await api(carol, "PATCH", `/api/calendar/${carolItems2.event}`, { groupId: foreign });
  check((await gidOf.event(carolItems2.event)) === carol.defaultGroupId, "l'événement n'a pas bougé (PATCH avec groupId étranger)");
  check((await gidOf.list(carolItems2.list)) === carol.defaultGroupId, "la liste est dans son foyer (aucune route ne la déplace)");

  // Création directement dans un foyer étranger : 403 et rien n'est créé.
  const tag = `Intrus ${run}`;
  const intrus = {
    recipe: await api(carol, "POST", "/api/recipes", { title: tag, groupId: foreign, steps: [] }),
    todo: await api(carol, "POST", "/api/todos", { title: tag, groupId: foreign }),
    list: await api(carol, "POST", "/api/lists", { name: tag, groupId: foreign }),
    event: await api(carol, "POST", "/api/calendar", { title: tag, groupId: foreign, date: new Date().toISOString() }),
    meal: await api(carol, "POST", "/api/meals", { date: "2030-01-01", slot: "dinner", note: tag, groupId: foreign }),
    subscription: await api(carol, "POST", "/api/calendar/subscriptions", { url: "https://example.com/x.ics", name: tag, groupId: foreign }),
  };
  for (const [kind, r] of Object.entries(intrus)) {
    check(r.status === 403, `POST ${kind} dans un foyer étranger refusé (${r.status})`);
  }
  const leaked =
    (await prisma.recipe.count({ where: { groupId: foreign, title: tag } })) +
    (await prisma.todo.count({ where: { groupId: foreign, title: tag } })) +
    (await prisma.shoppingList.count({ where: { groupId: foreign, name: tag } })) +
    (await prisma.calendarEvent.count({ where: { groupId: foreign, title: tag } })) +
    (await prisma.mealPlanEntry.count({ where: { groupId: foreign, note: tag } }));
  check(leaked === 0, "rien n'a été créé dans le foyer d'Alice");
  check(!(await listIds(alice, "recipe", alice.defaultGroupId)).has(carolItems2.recipe), "alice ne voit pas la recette de Carol");

  console.log("11b. Cas positifs : son propre foyer, puis aucun foyer");
  const carolHome = await api(carol, "POST", "/api/groups", { name: `Foyer de Carol ${run}` });
  check(!!carolHome.json?.id, `second foyer de Carol créé (${carolHome.status})`);
  const toOwn = await api(carol, "PATCH", `/api/recipes/${carolItems2.recipe}`, { groupId: carolHome.json.id });
  check(toOwn.status === 200, `déplacer sa recette vers son propre foyer (${toOwn.status})`);
  check((await gidOf.recipe(carolItems2.recipe)) === carolHome.json.id, "la recette est dans le nouveau foyer");
  await expectVisible(carol, { recipe: carolItems2.recipe }, carolHome.json.id, "après déplacement vers son foyer");

  const toNull = await api(carol, "PATCH", `/api/recipes/${carolItems2.recipe}`, { groupId: null });
  check(toNull.status === 200, `retirer sa recette de tout foyer (groupId null) (${toNull.status})`);
  check((await gidOf.recipe(carolItems2.recipe)) === null, "la recette n'a plus de foyer");
  await expectVisible(carol, { recipe: carolItems2.recipe }, carol.defaultGroupId, "recette sans foyer");
  await expectVisible(carol, { recipe: carolItems2.recipe }, carolHome.json.id, "recette sans foyer (vue de l'autre foyer)");
  await expectHidden(alice, { recipe: carolItems2.recipe }, "recette sans foyer");

  console.log("12. Semainier : il appartient à l'enfant, donc au foyer (exception assumée à l'ADR 0001, voir ADR 0002)");
  // Le semainier n'a pas d'auteur « propriétaire » : l'accès suit le groupe de l'enfant. Un membre
  // retiré du foyer perd l'accès à ce qu'il y a rempli ; rien n'est supprimé ni réattribué, et le
  // reste de ses éléments (recettes, tâches…) reste visible pour lui comme avant.
  {
    const ida = await makeUser("ida");
    const joe = await makeUser("joe");
    const kim = await makeUser("kim");
    await prisma.groupMember.create({ data: { groupId: ida.defaultGroupId, userId: joe.id } });
    const child = await prisma.familyProfile.create({
      data: { groupId: ida.defaultGroupId, name: `Enfant ${run}`, kind: "child" },
    });
    const kidRoutes = (user, trackerId) => ({
      "GET trackers": api(user, "GET", `/api/kids/trackers?profileId=${child.id}&all=1`),
      "POST trackers": api(user, "POST", "/api/kids/trackers", { profileId: child.id, label: "Intrus", icon: "star", kind: "count" }),
      "PATCH tracker": api(user, "PATCH", `/api/kids/trackers/${trackerId}`, { label: "Piraté" }),
      "DELETE tracker": api(user, "DELETE", `/api/kids/trackers/${trackerId}`),
      "PUT order": api(user, "PUT", "/api/kids/trackers/order", { profileId: child.id, ids: [trackerId] }),
      "GET week": api(user, "GET", `/api/kids/week?profileId=${child.id}&from=2026-10-05&to=2026-10-11`),
      "PATCH day": api(user, "PATCH", "/api/kids/day", { profileId: child.id, date: "2026-10-06", values: { Humeur: "Content" } }),
      "GET legacy": api(user, "GET", `/api/kids?profileId=${child.id}&from=2026-10-05&to=2026-10-11`),
    });
    const resolveAll = async (obj) => Object.fromEntries(await Promise.all(Object.entries(obj).map(async ([k, v]) => [k, await v])));

    const mood = await api(joe, "POST", "/api/kids/trackers", {
      profileId: child.id, label: "Humeur", icon: "face-happy", kind: "single",
      options: [{ label: "Content", icon: "face-happy" }, { label: "Triste", icon: "face-sad" }],
    });
    check(mood.status === 201, `un membre (clé API) crée une rubrique pour l'enfant (${mood.status})`);
    const wrote = await api(joe, "PATCH", "/api/kids/day", { profileId: child.id, date: "2026-10-06", values: { Humeur: "Content" } });
    check(wrote.status === 200, `un membre saisit une journée (${wrote.status})`);
    const joeRecipe = await api(joe, "POST", "/api/recipes", { title: `Recette de Joe ${run}`, groupId: ida.defaultGroupId, steps: [] });
    check(!!joeRecipe.json?.id, "Joe a aussi une recette dans le foyer");

    const idaWeek = await api(ida, "GET", `/api/kids/week?profileId=${child.id}&from=2026-10-05&to=2026-10-11`);
    const idaSees = idaWeek.json?.days?.find((d) => d.date === "2026-10-06")?.values?.[mood.json?.id]?.[0] === mood.json?.options?.[0]?.id;
    check(idaWeek.status === 200 && idaSees, "Ida (propriétaire) voit la saisie de Joe");

    for (const [name, r] of Object.entries(await resolveAll(kidRoutes(kim, mood.json.id)))) {
      check(r.status === 404, `Kim (hors foyer) : ${name} → 404 (${r.status})`);
    }
    const intact = await api(ida, "GET", `/api/kids/trackers?profileId=${child.id}&all=1`);
    check(intact.json?.length === 1 && intact.json[0].label === "Humeur", "les tentatives de Kim n'ont rien modifié");

    const kick = await api(ida, "DELETE", `/api/groups/${ida.defaultGroupId}/members/${joe.id}`);
    check(kick.status === 200, `Joe est retiré du foyer (${kick.status})`);
    for (const [name, r] of Object.entries(await resolveAll(kidRoutes(joe, mood.json.id)))) {
      check(r.status === 404, `Joe retiré : ${name} → 404 (exception documentée) (${r.status})`);
    }
    const kept = await prisma.kidDayEntry.findFirst({ where: { profileId: child.id, userId: joe.id } });
    check(!!kept, "la saisie de Joe n'est ni supprimée ni réattribuée");
    const idaAfter = await api(ida, "GET", `/api/kids/week?profileId=${child.id}&from=2026-10-05&to=2026-10-11`);
    check(idaAfter.json?.days?.find((d) => d.date === "2026-10-06")?.values?.[mood.json.id]?.[0] === mood.json.options[0].id, "Ida voit toujours la saisie de Joe");
    const joeKeeps = await api(joe, "GET", `/api/recipes/${joeRecipe.json.id}`);
    check(joeKeeps.status === 200, `ADR 0001 pour le reste : Joe voit toujours sa recette (${joeKeeps.status})`);
    await prisma.groupMember.create({ data: { groupId: ida.defaultGroupId, userId: joe.id } });
    const joeBack = await api(joe, "GET", `/api/kids/week?profileId=${child.id}&from=2026-10-05&to=2026-10-11`);
    check(joeBack.status === 200 && same(joeBack.json.days, idaAfter.json.days), "réintégré, Joe retrouve exactement la même semaine");
    const oldPatch = await api(joe, "PATCH", "/api/kids", { profileId: child.id, date: "2026-10-06", weather: "sunny" });
    check(oldPatch.status === 409, `l'ancien PATCH /api/kids renvoie 409 (${oldPatch.status})`);
  }

  console.log(`\n${checks - failures}/${checks} vérifications OK`);
}

try {
  await main();
} catch (e) {
  failures++;
  console.error("Erreur :", e);
} finally {
  await prisma.$disconnect();
}
if (failures > 0) {
  console.error(`ÉCHEC : ${failures} vérification(s) en erreur. Un élément n'est plus visible par son auteur.`);
  process.exit(1);
}
