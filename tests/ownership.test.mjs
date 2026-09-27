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
