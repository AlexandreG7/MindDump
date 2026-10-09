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
import net from "net";
import { readFileSync } from "fs";

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

/** Serveur SMTP factice : garde l'objet des e-mails reçus (le cron y envoie ses rappels). */
function startSmtpSink(port) {
  const subjects = [];
  const server = net.createServer((socket) => {
    let inData = false;
    let buffer = "";
    let mail = "";
    socket.write("220 sink ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let nl;
      while ((nl = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            const raw = mail.replace(/\r\n[ \t]+/g, " ");
            const m = /^Subject: (.*)$/im.exec(raw);
            let subject = m ? m[1] : "";
            // Objet éventuellement encodé en MIME (=?UTF-8?B?…?=).
            subject = subject.replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, b) => Buffer.from(b, "base64").toString("utf8"));
            subject = subject.replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, q) =>
              q.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (__, h) => String.fromCharCode(parseInt(h, 16))));
            subjects.push(subject);
            mail = "";
            socket.write("250 OK\r\n");
          } else {
            mail += line + "\r\n";
          }
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") socket.write("250 sink\r\n");
        else if (cmd === "DATA") { inData = true; socket.write("354 go\r\n"); }
        else if (cmd === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 OK\r\n");
      }
    });
    socket.on("error", () => {});
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ subjects, close: () => server.close() })));
}

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

  console.log("7. Cron : pas de rafale de rappels périmés (tâches à notifyBefore = 0)");
  const smtp = await startSmtpSink(Number(process.env.SMTP_PORT || 2599));
  try {
    const stale = await api(carol, "POST", "/api/todos", {
      title: `Rappel périmé ${run}`,
      dueDate: new Date(Date.now() - 3 * 60 * MIN).toISOString(),
      notifyBefore: 0,
    });
    const late = await api(carol, "POST", "/api/todos", {
      title: `Rappel en retard de 10 min ${run}`,
      dueDate: new Date(Date.now() - 10 * MIN).toISOString(),
      notifyBefore: 0,
    });
    check(stale.status === 201 && late.status === 201, `tâches à notifyBefore = 0 créées (${stale.status}/${late.status})`);
    check(stale.json.notifyBefore === 0, "notifyBefore = 0 conservé (à l'heure de l'échéance)");

    const cron = await fetch(BASE_URL + "/api/cron/notify", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.NEXTAUTH_SECRET}` },
    });
    check(cron.status === 200, `cron exécuté (${cron.status})`);

    const staleRow = await prisma.todo.findUnique({ where: { id: stale.json.id } });
    const lateRow = await prisma.todo.findUnique({ where: { id: late.json.id } });
    check(!smtp.subjects.some((s) => s.includes(`Rappel périmé ${run}`)), "échéance dépassée de 3 h → aucun envoi");
    check(staleRow?.notified === true, "échéance dépassée de 3 h → marquée notified en silence");
    check(smtp.subjects.some((s) => s.includes(`Rappel en retard de 10 min ${run}`)), "retard de 10 min → rappel envoyé");
    check(lateRow?.notified === true, "retard de 10 min → marquée notified");
  } finally {
    smtp.close();
  }

  console.log("8. API des tâches : validation stricte");
  const bad = [
    ["dueDate invalide", { dueDate: "abc" }],
    ["dueDate impossible (31 février)", { dueDate: "2026-02-31T10:00" }],
    ["dueDate impossible (mois 13)", { dueDate: "2026-13-45T10:00" }],
    ["dueDate à 24:00", { dueDate: "2026-10-09T24:00" }],
    ["notifyBefore négatif", { notifyBefore: -5 }],
    ["notifyBefore décimal", { notifyBefore: 1.5 }],
    ["notifyBefore trop grand", { notifyBefore: 525601 }],
    ["notifyBefore texte", { notifyBefore: "10" }],
  ];
  for (const [label, extra] of bad) {
    const r = await api(carol, "POST", "/api/todos", { title: `Invalide ${run}`, ...extra });
    check(r.status === 400 && typeof r.json?.error === "string", `POST ${label} → 400 (${r.status})`);
  }
  const target = await api(carol, "POST", "/api/todos", {
    title: `Cible ${run}`,
    dueDate: new Date(Date.now() + 60 * MIN).toISOString(),
    notifyBefore: 15,
  });
  for (const [label, extra] of bad) {
    const r = await api(carol, "PATCH", `/api/todos/${target.json.id}`, extra);
    check(r.status === 400, `PATCH ${label} → 400 (${r.status})`);
  }
  const intact = await prisma.todo.findUnique({ where: { id: target.json.id } });
  check(intact?.notifyBefore === 15 && intact?.dueDate !== null, "PATCH invalide : rien n'est effacé");
  const cleared = await api(carol, "PATCH", `/api/todos/${target.json.id}`, { notifyBefore: null });
  const clearedRow = await prisma.todo.findUnique({ where: { id: target.json.id } });
  check(cleared.status === 200 && clearedRow?.notifyBefore === null, "notifyBefore: null → rappel supprimé");

  console.log("9. Agenda : « à l'heure » (notifyBefore = 0), rappels périmés, iCal");
  const smtp2 = await startSmtpSink(Number(process.env.SMTP_PORT || 2599));
  try {
    const onTime = await api(carol, "POST", "/api/calendar", {
      title: `Agenda pile a l heure ${run}`,
      date: new Date(Date.now() - 5 * MIN).toISOString(),
      notifyBefore: 0,
    });
    const staleEvent = await api(carol, "POST", "/api/calendar", {
      title: `Agenda perime ${run}`,
      date: new Date(Date.now() - 3 * 60 * MIN).toISOString(),
      notifyBefore: 0,
    });
    const futureEvent = await api(carol, "POST", "/api/calendar", {
      title: `Événement futur ${run}`,
      date: new Date(Date.now() + 40 * MIN).toISOString(),
      notifyBefore: 0,
    });
    const noReminder = await api(carol, "POST", "/api/calendar", {
      title: `Événement sans rappel ${run}`,
      date: new Date(Date.now() - 5 * MIN).toISOString(),
      notifyBefore: null,
    });
    check([onTime, staleEvent, futureEvent, noReminder].every((r) => r.status === 201), "événements créés");
    check(onTime.json.notifyBefore === 0, "notifyBefore = 0 conservé sur un événement");
    check(noReminder.json.notifyBefore === null, "notifyBefore = null → pas de rappel");

    const carolUpcoming = await upcomingReminders(carol);
    check(has(carolUpcoming, futureEvent.json.id), "événement à notifyBefore = 0 → rappel local à l'heure");
    check(!has(carolUpcoming, noReminder.json.id), "événement sans rappel → aucun rappel local");

    const cron = await fetch(BASE_URL + "/api/cron/notify", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.NEXTAUTH_SECRET}` },
    });
    check(cron.status === 200, `cron exécuté (${cron.status})`);
    const onTimeRow = await prisma.calendarEvent.findUnique({ where: { id: onTime.json.id } });
    const staleRow2 = await prisma.calendarEvent.findUnique({ where: { id: staleEvent.json.id } });
    const futureRow = await prisma.calendarEvent.findUnique({ where: { id: futureEvent.json.id } });
    const noRow = await prisma.calendarEvent.findUnique({ where: { id: noReminder.json.id } });
    check(smtp2.subjects.some((s) => s.includes(`Agenda pile a l heure ${run}`)), "événement à l'heure (5 min de retard) → rappel envoyé");
    check(onTimeRow?.notified === true, "événement à l'heure → marqué notified");
    check(!smtp2.subjects.some((s) => s.includes(`Agenda perime ${run}`)), "événement périmé de 3 h → aucun envoi");
    check(staleRow2?.notified === true, "événement périmé de 3 h → marqué notified en silence");
    check(futureRow?.notified === false, "événement futur → pas encore traité");
    check(noRow?.notified === false && !smtp2.subjects.some((s) => s.includes(`Événement sans rappel ${run}`)), "événement sans rappel → ignoré par le cron");

    // Flux iCal : 0 → alarme à l'heure, null → pas d'alarme.
    const me = await prisma.user.findUnique({ where: { id: carol.id } });
    const token = me?.calendarToken ?? `cal-${run}`;
    if (!me?.calendarToken) await prisma.user.update({ where: { id: carol.id }, data: { calendarToken: token } });
    const feed = await fetch(`${BASE_URL}/api/calendar/feed/${token}`);
    const ics = await feed.text();
    const vevent = (title) => ics.split("BEGIN:VEVENT").find((b) => b.includes(`SUMMARY:${title}`)) ?? "";
    check(vevent(`Événement futur ${run}`).includes("TRIGGER:-PT0M"), "iCal : notifyBefore = 0 → TRIGGER:-PT0M");
    check(!vevent(`Événement sans rappel ${run}`).includes("VALARM"), "iCal : notifyBefore = null → pas d'alarme");

    // Une heure sans fuseau est lue à Paris, comme pour les tâches.
    const localEvent = await api(carol, "POST", "/api/calendar", { title: `Heure locale ${run}`, date: "2026-12-15T14:30" });
    check(localEvent.status === 201 && new Date(localEvent.json.date).toISOString() === "2026-12-15T13:30:00.000Z", "date sans fuseau lue à l'heure de Paris");
    const isoEvent = await api(carol, "POST", "/api/calendar", { title: `Heure ISO ${run}`, date: "2026-12-15T00:00:00.000Z", allDay: true });
    check(isoEvent.status === 201 && new Date(isoEvent.json.date).toISOString() === "2026-12-15T00:00:00.000Z", "ISO avec Z (page agenda) inchangé");
  } finally {
    smtp2.close();
  }

  console.log("10. API calendrier : validation stricte");
  const badEvents = [
    ["date absente", {}, true],
    ["date illisible", { date: "abc" }],
    ["date impossible (31 février)", { date: "2026-02-31T10:00" }],
    ["fin impossible", { date: "2026-12-15T10:00", endDate: "2026-13-45T10:00" }],
    ["notifyBefore négatif", { date: "2026-12-15T10:00", notifyBefore: -5 }],
    ["notifyBefore décimal", { date: "2026-12-15T10:00", notifyBefore: 1.5 }],
    ["notifyBefore trop grand", { date: "2026-12-15T10:00", notifyBefore: 525601 }],
    ["notifyBefore texte", { date: "2026-12-15T10:00", notifyBefore: "10" }],
  ];
  for (const [label, extra] of badEvents) {
    const r = await api(carol, "POST", "/api/calendar", { title: `Invalide ${run}`, ...extra });
    check(r.status === 400 && typeof r.json?.error === "string", `POST agenda ${label} → 400 (${r.status})`);
  }
  const evTarget = await api(carol, "POST", "/api/calendar", {
    title: `Cible agenda ${run}`,
    date: new Date(Date.now() + 120 * MIN).toISOString(),
    notifyBefore: 15,
  });
  for (const [label, extra] of badEvents.slice(1)) {
    const patch = { ...extra };
    if (label.startsWith("notifyBefore")) delete patch.date;
    const r = await api(carol, "PATCH", `/api/calendar/${evTarget.json.id}`, patch);
    check(r.status === 400, `PATCH agenda ${label} → 400 (${r.status})`);
  }
  const evNullDate = await api(carol, "PATCH", `/api/calendar/${evTarget.json.id}`, { date: null });
  check(evNullDate.status === 400, `PATCH agenda date null → 400 (${evNullDate.status})`);
  const evIntact = await prisma.calendarEvent.findUnique({ where: { id: evTarget.json.id } });
  check(evIntact?.notifyBefore === 15 && evIntact?.endDate === null, "PATCH agenda invalide : rien n'est modifié");
  const toZero = await api(carol, "PATCH", `/api/calendar/${evTarget.json.id}`, { notifyBefore: 0 });
  const zeroRow = await prisma.calendarEvent.findUnique({ where: { id: evTarget.json.id } });
  check(toZero.status === 200 && zeroRow?.notifyBefore === 0, "PATCH notifyBefore: 0 → rappel à l'heure (pas supprimé)");
  const toNull = await api(carol, "PATCH", `/api/calendar/${evTarget.json.id}`, { notifyBefore: null });
  const nullRow = await prisma.calendarEvent.findUnique({ where: { id: evTarget.json.id } });
  check(toNull.status === 200 && nullRow?.notifyBefore === null, "PATCH notifyBefore: null → rappel supprimé");

  console.log("11. Migration : les anciens notifyBefore = 0 deviennent « pas de rappel »");
  // Lignes telles qu'elles existaient AVANT la migration (0 = pas de rappel),
  // puis on rejoue le SQL de la migration (le test s'exécute après `migrate deploy`).
  const legacyTodo = await prisma.todo.create({
    data: { title: `Ancien 0 ${run}`, userId: carol.id, dueDate: new Date(Date.now() + 60 * MIN), notifyBefore: 0 },
  });
  const keptTodo = await prisma.todo.create({
    data: { title: `Rappel 15 ${run}`, userId: carol.id, dueDate: new Date(Date.now() + 60 * MIN), notifyBefore: 15 },
  });
  const legacyEvent = await prisma.calendarEvent.create({
    data: { title: `Ancien 0 agenda ${run}`, userId: carol.id, date: new Date(Date.now() + 60 * MIN), notifyBefore: 0 },
  });
  const keptEvent = await prisma.calendarEvent.create({
    data: { title: `Rappel 30 agenda ${run}`, userId: carol.id, date: new Date(Date.now() + 60 * MIN), notifyBefore: 30 },
  });
  const sql = readFileSync("prisma/migrations/20261009100000_reminder_zero_means_on_time/migration.sql", "utf8");
  const statements = sql.split("\n").filter((l) => !l.startsWith("--")).join("\n").split(";").map((x) => x.trim()).filter(Boolean);
  check(statements.length === 2, `la migration contient 2 ordres UPDATE (${statements.length})`);
  const before = { todos: await prisma.todo.count(), events: await prisma.calendarEvent.count() };
  for (const st of statements) await prisma.$executeRawUnsafe(st);
  const after = { todos: await prisma.todo.count(), events: await prisma.calendarEvent.count() };
  check(before.todos === after.todos && before.events === after.events, "aucune ligne supprimée par la migration");
  const rows = {
    legacyTodo: await prisma.todo.findUnique({ where: { id: legacyTodo.id } }),
    keptTodo: await prisma.todo.findUnique({ where: { id: keptTodo.id } }),
    legacyEvent: await prisma.calendarEvent.findUnique({ where: { id: legacyEvent.id } }),
    keptEvent: await prisma.calendarEvent.findUnique({ where: { id: keptEvent.id } }),
  };
  check(rows.legacyTodo?.notifyBefore === null, "tâche à notifyBefore = 0 → null");
  check(rows.legacyEvent?.notifyBefore === null, "événement à notifyBefore = 0 → null");
  check(rows.keptTodo?.notifyBefore === 15 && rows.keptEvent?.notifyBefore === 30, "les vrais rappels (15, 30) sont conservés");
  check(rows.legacyTodo?.title === legacyTodo.title && rows.legacyTodo?.userId === carol.id, "l'ancienne tâche reste intacte et attachée à son auteur (ADR 0001)");
  check(has(await upcomingReminders(carol), keptTodo.id) && !has(await upcomingReminders(carol), legacyTodo.id), "après migration : plus de rappel fantôme pour l'ancien 0");

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
