/**
 * Rappels locaux de l'app mobile (GET /api/reminders/upcoming,
 * src/lib/reminders.ts). Même règle de destinataires que le push web / e-mail
 * (src/lib/notify.ts) : voir docs/adr/0001-les-elements-restent-attaches-a-leur-auteur.md.
 *
 * Bout en bout, par HTTP, contre un serveur MindDump lancé sur une base JETABLE
 * (même principe que tests/ownership.test.mjs). En local : npm run test:reminders.
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

async function upcomingReminders(user) {
  const r = await api(user, "GET", "/api/reminders/upcoming");
  if (r.status !== 200) throw new Error(`GET /api/reminders/upcoming → ${r.status}`);
  return r.json.reminders;
}

function has(reminders, itemId) {
  return reminders.some((r) => r.itemId === itemId);
}

const MIN = 60 * 1000;

async function main() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");

  // Bob rejoint le foyer d'Alice.
  await prisma.groupMember.create({ data: { groupId: alice.defaultGroupId, userId: bob.id } });
  const profilesRes = await api(alice, "GET", `/api/groups/${alice.defaultGroupId}/profiles`);
  const bobProfile = profilesRes.json.find((p) => p.userId === bob.id);
  if (!bobProfile) throw new Error("Profil de Bob introuvable après synchronisation");

  console.log("1. Tâche assignée à Bob");
  const dueSoon = new Date(Date.now() + 15 * MIN);
  const assignedTodo = await api(alice, "POST", "/api/todos", {
    title: `Tâche assignée ${run}`,
    groupId: alice.defaultGroupId,
    dueDate: dueSoon.toISOString(),
    notifyBefore: 10,
    assigneeIds: [bobProfile.id],
  });
  check(assignedTodo.status === 201, `tâche assignée créée (${assignedTodo.status})`);

  const bobReminders1 = await upcomingReminders(bob);
  const aliceReminders1 = await upcomingReminders(alice);
  check(has(bobReminders1, assignedTodo.json.id), "tâche assignée à Bob → rappel pour Bob");
  check(!has(aliceReminders1, assignedTodo.json.id), "tâche assignée à Bob → pas de rappel pour Alice (créatrice non ciblée)");

  console.log("2. Tâche sans assignation dans le groupe");
  const sharedTodo = await api(alice, "POST", "/api/todos", {
    title: `Tâche du foyer ${run}`,
    groupId: alice.defaultGroupId,
    dueDate: dueSoon.toISOString(),
    notifyBefore: 10,
  });
  check(sharedTodo.status === 201, `tâche partagée créée (${sharedTodo.status})`);
  const bobReminders2 = await upcomingReminders(bob);
  const aliceReminders2 = await upcomingReminders(alice);
  check(has(bobReminders2, sharedTodo.json.id), "tâche sans assignation → rappel pour Bob");
  check(has(aliceReminders2, sharedTodo.json.id), "tâche sans assignation → rappel pour Alice");

  console.log("3. Bob est retiré du foyer : plus de rappel");
  const removed = await api(alice, "DELETE", `/api/groups/${alice.defaultGroupId}/members/${bob.id}`);
  check(removed.status === 200, `retrait de Bob (${removed.status})`);
  const bobReminders3 = await upcomingReminders(bob);
  const aliceReminders3 = await upcomingReminders(alice);
  check(!has(bobReminders3, sharedTodo.json.id), "Bob retiré du foyer → plus de rappel pour la tâche partagée");
  check(has(aliceReminders3, sharedTodo.json.id), "Alice (créatrice) garde son rappel après le départ de Bob");
  // Et la tâche assignée à Bob (qui ne le voit plus) ne le prévient plus non plus.
  check(!has(bobReminders3, assignedTodo.json.id), "Bob retiré du foyer → plus de rappel pour la tâche qui lui était assignée");

  console.log("4. Événement récurrent : plusieurs occurrences sous 30 jours");
  const start = new Date(Date.now() + 2 * 24 * 60 * MIN); // dans 2 jours
  const recurringEvent = await api(alice, "POST", "/api/calendar", {
    title: `Réunion hebdo ${run}`,
    groupId: alice.defaultGroupId,
    date: start.toISOString(),
    recurrence: "weekly",
    notifyBefore: 10,
  });
  check(recurringEvent.status === 201, `événement récurrent créé (${recurringEvent.status})`);
  const aliceReminders4 = await upcomingReminders(alice);
  const occurrences = aliceReminders4.filter((r) => r.itemId === recurringEvent.json.id);
  // 2j, 9j, 16j, 23j, 30j après aujourd'hui : au moins 4 occurrences sous 30 jours.
  check(occurrences.length >= 4, `événement hebdomadaire → plusieurs occurrences (${occurrences.length})`);
  const sortedFireAt = occurrences.map((o) => o.fireAt).slice().sort();
  check(
    JSON.stringify(occurrences.map((o) => o.fireAt)) === JSON.stringify(sortedFireAt),
    "les occurrences sont triées par date de rappel"
  );
  check(occurrences.every((o) => o.key.startsWith(`event-${recurringEvent.json.id}-`)), "chaque occurrence a une clé stable distincte");

  console.log("5. Réglages de rappels désactivés");
  const prefs = await api(alice, "PATCH", "/api/users/me/notifications", { notifyReminders: false });
  check(prefs.status === 200 && prefs.json.notifyReminders === false, `rappels désactivés (${prefs.status})`);
  const aliceReminders5 = await upcomingReminders(alice);
  check(aliceReminders5.length === 0, `réglages désactivés → liste vide (${aliceReminders5.length} élément(s))`);
  // Ça ne doit pas affecter les autres utilisateurs.
  const reenable = await api(alice, "PATCH", "/api/users/me/notifications", { notifyReminders: true });
  check(reenable.status === 200 && reenable.json.notifyReminders === true, "rappels réactivés");

  console.log("6. Utilisateur sans lien avec Alice ni son groupe");
  const carol = await makeUser("carol");
  const carolReminders = await upcomingReminders(carol);
  check(carolReminders.length === 0, `Carol (sans lien) ne reçoit aucun rappel (${carolReminders.length})`);
  check(
    !has(carolReminders, sharedTodo.json.id) && !has(carolReminders, recurringEvent.json.id),
    "les éléments d'Alice n'apparaissent pas chez Carol"
  );
  // Carol a ses propres rappels : le pré-filtre ne la prive pas des siens.
  const carolTodo = await api(carol, "POST", "/api/todos", {
    title: `Tâche de Carol ${run}`,
    dueDate: dueSoon.toISOString(),
    notifyBefore: 10,
  });
  check(has(await upcomingReminders(carol), carolTodo.json.id), "Carol voit son propre rappel");
  // Cas ADR 0001 : Bob (ancien membre) garde les éléments dont il est l'auteur.
  const bobTodo = await prisma.todo.create({
    data: {
      title: `Tâche de Bob ${run}`,
      userId: bob.id,
      groupId: alice.defaultGroupId,
      dueDate: dueSoon,
      notifyBefore: 10,
    },
  });
  check(has(await upcomingReminders(bob), bobTodo.id), "Bob (auteur, plus membre) garde le rappel de sa tâche");
  check(!has(await upcomingReminders(carol), bobTodo.id), "Carol ne reçoit pas la tâche de Bob");

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
  console.error(`ÉCHEC : ${failures} vérification(s) en erreur.`);
  process.exit(1);
}
