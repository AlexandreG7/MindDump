/**
 * Test du semainier (rubriques choisies par la famille) : données, API, accès.
 * Voir docs/semainier/02-plan-technique.md et docs/adr/0001-*.md.
 *
 * Lancé par scripts/test-kids.sh, en plusieurs phases sur UNE base jetable :
 *   seed      base au SCHÉMA DE PRODUCTION (migrations avant celle des rubriques) avec des
 *             saisies existantes de l'ancien semainier (colonnes fixes) ;
 *   migrated  juste après la migration : rien n'a bougé, `values` est nul ;
 *   lazy      serveur démarré, AVANT la reprise : une lecture convertit à la volée ;
 *   verify    après prisma/backfill-kid-trackers.js : aucune perte, mêmes résultats ;
 *   snapshot  état complet de la base (comparé avant/après un 2e passage du backfill) ;
 *   api       parcours de l'API (accès, écriture, masquage, concurrence, ancien PATCH…).
 *
 * Variables : BASE_URL, DATABASE_URL (base jetable, JAMAIS la prod), KIDS_TEST_STATE.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const STATE_FILE = process.env.KIDS_TEST_STATE;
if (process.env.OWNERSHIP_TEST_DB !== "disposable" || !STATE_FILE) {
  console.error("Refus : OWNERSHIP_TEST_DB=disposable et KIDS_TEST_STATE requis (ce test écrit dans la base).");
  process.exit(2);
}

const prisma = new PrismaClient();
const phase = process.argv[2];
let failures = 0;
let checks = 0;

function check(cond, label) {
  checks++;
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const loadState = () => JSON.parse(readFileSync(STATE_FILE, "utf8"));
const saveState = (s) => writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

async function makeUser(run, name) {
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
    headers: { ...(user ? { authorization: `Bearer ${user.key}` } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* corps non JSON */ }
  return { status: res.status, json };
}

// ─── Données de l'ancien semainier ────────────────────────────────────────────

const WEATHER = { sunny: "Soleil", "partly-cloudy": "Éclaircies", cloudy: "Nuages", rainy: "Pluie", stormy: "Orage", snowy: "Neige" };
const MOOD = { "very-happy": "Très content", happy: "Content", neutral: "Bof", sad: "Triste", angry: "Fâché" };
const ACT = {
  painting: "Peinture", reading: "Lecture", sport: "Sport", music: "Musique", puzzle: "Puzzle", park: "Parc",
  cooking: "Cuisine", swimming: "Piscine", friends: "Copains", crafts: "Bricolage", animals: "Animaux", dressup: "Déguisement",
};
// Rubriques créées par la reprise (libellés neutres, rien ne s'appelle comme l'ancienne interface).
const T = { weather: "Météo", mood: "Humeur", accident: "Goutte", nap: "Lune", activities: "Activités" };

/** Saisies d'un enfant, telles que l'ancienne version les a écrites (a/b = auteur). */
const LEGACY_ROWS = [
  { date: "2026-10-05", weather: "sunny", mood: "happy", nap: true, accident: false, activities: ["painting", "park"], by: "a" },
  { date: "2026-10-06", weather: "rainy", mood: "sad", nap: false, accident: true, activities: [], by: "b" },
  { date: "2026-10-07", weather: "cloudy", mood: "very-happy", nap: null, accident: null, activities: ["puzzle", "reading", "music"], by: "a" },
  { date: "2026-10-08", weather: null, mood: null, nap: null, accident: null, activities: [], by: "b" },
  { date: "2026-10-09", weather: "snowy", mood: null, nap: null, accident: null, activities: [], by: "a" },
  { date: "2026-10-10", weather: null, mood: null, nap: null, accident: null, activities: ["dressup"], by: "b" },
  {
    date: "2026-10-11", weather: "partly-cloudy", mood: "angry", nap: true, accident: false,
    activities: ["swimming", "friends", "crafts", "animals", "cooking", "sport"], by: "a",
  },
  { date: "2026-10-04", weather: null, mood: "neutral", nap: null, accident: null, activities: [], by: "a" },
  // Valeur inconnue du catalogue : jamais inventée, l'ancienne colonne la garde.
  { date: "2026-10-03", weather: "stormy", mood: "bizarre", nap: null, accident: null, activities: [], by: "b" },
  // Colonne d'activités illisible.
  { date: "2026-10-02", weather: "sunny", mood: null, nap: null, accident: null, activities: "[pas du json", by: "a" },
];
// Un enfant qui n'a jamais utilisé les deux rubriques à choix Oui/Non.
const TOM_ROWS = LEGACY_ROWS.filter((r) => r.nap === null && r.accident === null);

function expectedReadable(row) {
  const out = {};
  if (row.weather && WEATHER[row.weather]) out[T.weather] = [WEATHER[row.weather]];
  if (row.mood && MOOD[row.mood]) out[T.mood] = [MOOD[row.mood]];
  if (row.accident !== null) out[T.accident] = [row.accident ? "Oui" : "Non"];
  if (row.nap !== null) out[T.nap] = [row.nap ? "Oui" : "Non"];
  const acts = Array.isArray(row.activities) ? row.activities.map((a) => ACT[a]).filter(Boolean) : [];
  if (acts.length > 0) out[T.activities] = acts;
  return out;
}

async function insertLegacy(profileId, rows, users) {
  for (const r of rows) {
    const acts = typeof r.activities === "string" ? r.activities : JSON.stringify(r.activities);
    // SQL brut : le client généré connaît déjà la colonne `values`, absente de la base de production.
    await prisma.$executeRaw`
      INSERT INTO "KidDayEntry" (id, date, weather, mood, nap, accident, activities, "createdAt", "updatedAt", "userId", "profileId")
      VALUES (${"kde" + randomBytes(8).toString("hex")}, ${r.date}, ${r.weather}, ${r.mood}, ${r.nap}, ${r.accident}, ${acts},
              '2026-10-01T08:00:00Z', '2026-10-12T19:30:00Z', ${users[r.by].id}, ${profileId})`;
  }
}

async function rawEntries(profileId) {
  return prisma.$queryRaw`
    SELECT id, date, weather, mood, nap, accident, activities, "userId", "updatedAt", "createdAt"
    FROM "KidDayEntry" WHERE "profileId" = ${profileId} ORDER BY date`;
}

// ─── Phase seed : base au schéma de production ────────────────────────────────

async function seed() {
  const run = randomBytes(4).toString("hex");
  const a = await makeUser(run, "parent-a");
  const b = await makeUser(run, "parent-b");
  const c = await makeUser(run, "autre");
  await prisma.groupMember.create({ data: { groupId: a.defaultGroupId, userId: b.id } });
  const mk = (groupId, name, position) =>
    prisma.familyProfile.create({ data: { groupId, name, kind: "child", color: "#ec4899", position } });
  const lea = await mk(a.defaultGroupId, "Léa", 0);
  const twin = await mk(a.defaultGroupId, "Léa (jumelle de test)", 1);
  const tom = await mk(a.defaultGroupId, "Tom", 2);
  const zoe = await mk(a.defaultGroupId, "Zoé", 3);
  const autre = await mk(c.defaultGroupId, "Enfant d'un autre foyer", 0);
  const users = { a, b, c };

  await insertLegacy(lea.id, LEGACY_ROWS, users);
  await insertLegacy(twin.id, LEGACY_ROWS, users);
  await insertLegacy(tom.id, TOM_ROWS, users);
  await insertLegacy(autre.id, LEGACY_ROWS.slice(0, 3), { a: c, b: c });
  // Saisie ancienne sans enfant (antérieure aux profils) : hors périmètre, doit rester intacte.
  await prisma.$executeRaw`
    INSERT INTO "KidDayEntry" (id, date, weather, activities, "createdAt", "updatedAt", "userId", "profileId")
    VALUES (${"kde" + randomBytes(8).toString("hex")}, '2026-10-01', 'sunny', '[]', now(), now(), ${a.id}, NULL)`;

  const total = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry"`)[0].n);
  const cols = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'KidDayEntry' AND column_name = 'values'`;
  const tables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables WHERE table_name IN ('KidTracker', 'KidTrackerOption')`;
  console.log("1. Base au schéma de production");
  check(cols.length === 0 && tables.length === 0, "la base n'a ni colonne `values` ni table de rubriques (schéma de prod)");
  check(total === LEGACY_ROWS.length * 2 + TOM_ROWS.length + 3 + 1, `${total} saisies existantes semées`);

  const entries = {};
  for (const [name, p] of Object.entries({ lea, twin, tom, autre })) {
    entries[name] = (await rawEntries(p.id)).map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString(), createdAt: r.createdAt.toISOString() }));
  }
  saveState({
    run, total,
    users: { a: a.key, b: b.key, c: c.key },
    userIds: { a: a.id, b: b.id, c: c.id },
    groupIds: { a: a.defaultGroupId, c: c.defaultGroupId },
    profiles: { lea: lea.id, twin: twin.id, tom: tom.id, zoe: zoe.id, autre: autre.id },
    entries,
  });
}

// ─── Phase migrated : la migration n'a rien touché ────────────────────────────

async function migrated() {
  const s = loadState();
  console.log("2. Après la migration (expand), avant toute reprise");
  const total = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry"`)[0].n);
  check(total === s.total, `même nombre de saisies (${total}/${s.total})`);
  const nulls = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry" WHERE "values" IS NULL`)[0].n);
  check(nulls === s.total, "toutes les saisies ont `values` nul (rien converti par la migration seule)");
  const trackers = await prisma.kidTracker.count();
  check(trackers === 0, "aucune rubrique créée par la migration");
}

// ─── Lecture des rubriques et des valeurs en base ─────────────────────────────

async function readableFromDb(profileId) {
  const trackers = await prisma.kidTracker.findMany({
    where: { profileId }, include: { options: true }, orderBy: { position: "asc" },
  });
  const optionLabel = new Map();
  for (const t of trackers) for (const o of t.options) optionLabel.set(o.id, o.label);
  const trackerLabel = new Map(trackers.map((t) => [t.id, t.label]));
  const entries = await prisma.kidDayEntry.findMany({ where: { profileId }, orderBy: { date: "asc" } });
  const byDate = {};
  for (const e of entries) {
    if (e.values === null) { byDate[e.date] = null; continue; }
    const out = {};
    for (const [tid, v] of Object.entries(e.values)) {
      out[trackerLabel.get(tid) ?? `?${tid}`] = Array.isArray(v) ? v.map((id) => optionLabel.get(id) ?? `?${id}`) : v;
    }
    byDate[e.date] = out;
  }
  return { trackers, byDate };
}

const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v]).sort()));

async function lazy() {
  const s = loadState();
  const A = { key: s.users.a }, C = { key: s.users.c };
  console.log("3. Lecture tolérante (avant la reprise au démarrage)");

  // L'export RGPD est en lecture seule : il lit les anciennes colonnes sans rien convertir ni créer.
  const { exportUserData } = await import("../src/lib/account.ts");
  const nullsBeforeExport = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry" WHERE "values" IS NULL`)[0].n);
  const exportA = await exportUserData(s.userIds.a);
  const nullsAfterExport = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry" WHERE "values" IS NULL`)[0].n);
  check(nullsBeforeExport === s.total && nullsAfterExport === s.total && (await prisma.kidTracker.count()) === 0, "export RGPD : aucune ligne convertie, aucune rubrique créée (lecture seule)");
  const exportedLegacy = exportA.user.kidDayEntries.filter((e) => e.profile?.id === s.profiles.twin);
  const authoredByA = LEGACY_ROWS.filter((r) => r.by === "a");
  let exportOk = exportedLegacy.length === authoredByA.length;
  for (const e of exportedLegacy) {
    const row = LEGACY_ROWS.find((r) => r.date === e.date);
    if (!row || sorted(e.readableValues) !== sorted(expectedReadable(row))) { exportOk = false; console.log("   écart export", e.date, JSON.stringify(e.readableValues)); }
  }
  check(exportOk && exportA.user.kidTrackers.length === 0, "export RGPD : les saisies non reprises sont lues depuis les anciennes colonnes, en clair, sans rubrique en base");

  // Un non-membre n'obtient rien et ne déclenche aucune conversion.
  const denied = await api(C, "GET", `/api/kids/week?profileId=${s.profiles.twin}&from=2026-10-01&to=2026-10-11`);
  check(denied.status === 404, `un non-membre reçoit 404 (${denied.status})`);
  const stillNull = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry" WHERE "profileId" = ${s.profiles.twin} AND "values" IS NULL`)[0].n);
  check(stillNull === LEGACY_ROWS.length, "sa tentative n'a rien converti");

  const week = await api(A, "GET", `/api/kids/week?profileId=${s.profiles.twin}&from=2026-10-01&to=2026-10-11`);
  check(week.status === 200, `un membre lit la semaine d'un enfant non repris (${week.status})`);
  const labels = (week.json?.trackers || []).map((t) => t.label);
  check(same(labels, ["Météo", "Humeur", "Goutte", "Lune", "Activités"]), `rubriques reprises, dans l'ordre de l'ancienne interface (${labels.join(", ")})`);
  const optLabel = new Map();
  const trLabel = new Map();
  for (const t of week.json.trackers) { trLabel.set(t.id, t.label); for (const o of t.options) optLabel.set(o.id, o.label); }
  let ok = true;
  for (const d of week.json.days) {
    const row = LEGACY_ROWS.find((r) => r.date === d.date);
    const got = {};
    for (const [tid, v] of Object.entries(d.values)) got[trLabel.get(tid)] = v.map((id) => optLabel.get(id));
    if (sorted(got) !== sorted(row ? expectedReadable(row) : {})) { ok = false; console.log("   écart", d.date, JSON.stringify(got)); }
  }
  check(ok, "chaque jour lu à la volée correspond à la saisie d'origine");
  const nullsAfter = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry" WHERE "profileId" = ${s.profiles.twin} AND "values" IS NULL`)[0].n);
  check(nullsAfter === 0, "la lecture a converti les lignes de cet enfant (idempotent, sans perdre l'ancien)");

  const tomActive = await api(A, "GET", `/api/kids/trackers?profileId=${s.profiles.tom}`);
  check(same(tomActive.json?.map((t) => t.label), ["Météo", "Humeur", "Activités"]), "Tom (aucune saisie Oui/Non) : les deux rubriques sans saisie sont masquées");
  const tomAll = await api(A, "GET", `/api/kids/trackers?profileId=${s.profiles.tom}&all=1`);
  check(tomAll.json?.length === 5, "…mais réactivables (all=1 en liste cinq)");
  const nr = Object.fromEntries((tomAll.json || []).map((t) => [t.label, t.needsRename]));
  check(nr["Goutte"] === true && nr["Lune"] === true && nr["Météo"] === false, "needsRename signale Goutte et Lune seulement");
  const zoe = await api(A, "GET", `/api/kids/trackers?profileId=${s.profiles.zoe}&all=1`);
  check(zoe.status === 200 && zoe.json?.length === 0, "un enfant sans saisie n'a aucune rubrique (état vide, rien de proposé)");
}

// ─── Phase verify : après la reprise au démarrage ─────────────────────────────

async function verify() {
  const s = loadState();
  console.log("4. Reprise au démarrage (prisma/backfill-kid-trackers.js)");
  const total = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry"`)[0].n);
  check(total === s.total, `aucune saisie perdue ni ajoutée (${total}/${s.total})`);

  const rows = { lea: LEGACY_ROWS, twin: LEGACY_ROWS, tom: TOM_ROWS, autre: LEGACY_ROWS.slice(0, 3) };
  for (const [name, legacy] of Object.entries(rows)) {
    const pid = s.profiles[name];
    const { trackers, byDate } = await readableFromDb(pid);
    let ok = true;
    for (const r of legacy) {
      if (byDate[r.date] === null || sorted(byDate[r.date] ?? {}) !== sorted(expectedReadable(r))) {
        ok = false; console.log("   écart", name, r.date, JSON.stringify(byDate[r.date]));
      }
    }
    check(ok && Object.keys(byDate).length === legacy.length, `${name} : chaque valeur d'origine est retrouvée dans values (${legacy.length} jours)`);
    check(trackers.length === 5 && new Set(trackers.map((t) => t.legacyKey)).size === 5, `${name} : cinq rubriques reprises, sans doublon`);
    const active = Object.fromEntries(trackers.map((t) => [t.label, t.active]));
    const wantHidden = name === "tom";
    check(
      active["Météo"] && active["Humeur"] && active["Activités"] && active["Goutte"] === !wantHidden && active["Lune"] === !wantHidden,
      `${name} : Météo, Humeur, Activités actives ; Goutte et Lune ${wantHidden ? "masquées (aucune saisie)" : "actives (saisies existantes)"}`
    );
    // Les anciennes colonnes, l'auteur et les dates ne bougent pas (ADR 0001).
    const before = s.entries[name];
    const after = (await rawEntries(pid)).map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString(), createdAt: r.createdAt.toISOString() }));
    check(same(before, after), `${name} : colonnes d'origine, auteur et dates inchangés`);
  }
  const hasNoValues = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry" WHERE "values" IS NULL`)[0].n);
  check(hasNoValues === 1, "seule la saisie sans enfant (hors périmètre) garde values nul");
  check((await prisma.kidTracker.count({ where: { profileId: s.profiles.zoe } })) === 0, "Zoé (aucune saisie) : aucune rubrique créée");

  // Lecture à la volée (jumelle) et reprise au démarrage (Léa) : même résultat.
  const L = await readableFromDb(s.profiles.lea);
  const W = await readableFromDb(s.profiles.twin);
  check(same(L.byDate, W.byDate), "lecture tolérante et reprise au démarrage donnent exactement les mêmes valeurs");
  const shape = (ts) => ts.map((t) => [t.label, t.icon, t.kind, t.position, t.active, t.needsRename, t.legacyKey, t.options.sort((x, y) => x.position - y.position).map((o) => [o.label, o.icon, o.position, o.legacyValue])]);
  check(same(shape(L.trackers), shape(W.trackers)), "mêmes rubriques, choix, images et ordre dans les deux cas");

  // Aucune rubrique ni image ne porte l'ancien vocabulaire.
  const all = await prisma.kidTracker.findMany({ include: { options: true } });
  const blob = JSON.stringify(all.map((t) => [t.label, t.icon, t.options.map((o) => [o.label, o.icon])])).toLowerCase();
  check(!/pipi|sieste|potty|pee\b/.test(blob), "ni libellé ni image des rubriques reprises ne reprend l'ancien vocabulaire");
  const KID_ICONS = new Set("sun sun-cloud cloud rain storm snow moon star rainbow drop leaf flower tree face-very-happy face-happy face-neutral face-sad face-angry brush book ball music puzzle pan wave people scissors paw mask bike car house backpack cake heart cup check cross bell gift".split(" "));
  check(all.every((t) => KID_ICONS.has(t.icon) && t.options.every((o) => KID_ICONS.has(o.icon))), "toutes les images reprises sont dans la bibliothèque");
}

async function snapshot() {
  const entries = await prisma.$queryRaw`SELECT * FROM "KidDayEntry" ORDER BY id`;
  const trackers = await prisma.kidTracker.findMany({ include: { options: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } });
  process.stdout.write(JSON.stringify({ entries, trackers }, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}

// ─── Phases isolation : un enfant en échec n'arrête pas la reprise des autres ─

const ISO_FILE_KEY = "isolation";

async function isolationSeed() {
  const s = loadState();
  const run = randomBytes(4).toString("hex");
  const u = await makeUser(run, "iso");
  const mk = (name, position) => prisma.familyProfile.create({ data: { groupId: u.defaultGroupId, name, kind: "child", position } });
  const kids = { bad: await mk("Prénom-secret-défaillant", 0), good1: await mk("Prénom-secret-bon-1", 1), good2: await mk("Prénom-secret-bon-2", 2) };
  for (const k of Object.values(kids)) {
    await prisma.$executeRaw`
      INSERT INTO "KidDayEntry" (id, date, weather, mood, activities, "createdAt", "updatedAt", "userId", "profileId")
      VALUES (${"kde" + randomBytes(8).toString("hex")}, '2026-10-05', 'sunny', 'happy', '["park"]', now(), now(), ${u.id}, ${k.id})`;
  }
  // Panne simulée : toute création de rubrique pour cet enfant échoue, avec un message qui contient des données.
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION kid_test_fail() RETURNS trigger AS $$
    BEGIN
      IF NEW."profileId" = '${kids.bad.id}' THEN RAISE EXCEPTION 'panne simulee Prénom-secret-défaillant'; END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER kid_test_fail BEFORE INSERT ON "KidTracker" FOR EACH ROW EXECUTE FUNCTION kid_test_fail()`);
  s[ISO_FILE_KEY] = { bad: kids.bad.id, good1: kids.good1.id, good2: kids.good2.id };
  saveState(s);
  console.log("   enfants de test créés, panne simulée sur l'un d'eux");
}

async function isolationCheck(step) {
  const s = loadState();
  const ids = s[ISO_FILE_KEY];
  const nulls = async (id) => Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidDayEntry" WHERE "profileId" = ${id} AND "values" IS NULL`)[0].n);
  if (step === "failed") {
    console.log("   Reprise avec un enfant en échec");
    const log = readFileSync(process.env.KIDS_ISOLATION_LOG, "utf8");
    check((await nulls(ids.good1)) === 0 && (await nulls(ids.good2)) === 0, "les deux autres enfants sont repris malgré l'échec du premier");
    check((await nulls(ids.bad)) === 1, "l'enfant en échec reste intact (transaction annulée), à reprendre plus tard");
    check(/skipped/.test(log), "le journal signale l'enfant ignoré");
    check(!log.includes(ids.bad) && !log.includes("secret") && !log.includes("panne") && !log.includes("Prénom"), "le journal ne contient ni nom, ni identifiant, ni message d'erreur");
  } else {
    console.log("   Reprise une fois la panne levée");
    check((await nulls(ids.bad)) === 0, "au démarrage suivant, l'enfant ignoré est repris");
  }
}

// ─── Phase api ────────────────────────────────────────────────────────────────

// Nombre d'images : lu dans la source unique, jamais figé en dur.
const ICON_COUNT = (readFileSync(new URL("../src/lib/kidIconIds.ts", import.meta.url), "utf8").match(/^\s+\{ id: "/gm) ?? []).length;

async function apiPhase() {
  const s = loadState();
  const run = randomBytes(4).toString("hex");
  const alice = await makeUser(run, "alice");
  const bob = await makeUser(run, "bob");
  const carol = await makeUser(run, "carol");
  await prisma.groupMember.create({ data: { groupId: alice.defaultGroupId, userId: bob.id } });
  const kid = await prisma.familyProfile.create({ data: { groupId: alice.defaultGroupId, name: "Nina", kind: "child", position: 0 } });
  const other = await prisma.familyProfile.create({ data: { groupId: carol.defaultGroupId, name: "Enfant de Carol", kind: "child", position: 0 } });
  const P = kid.id;
  const choices = (...labels) => labels.map((l, i) => ({ label: l, icon: ["sun", "cloud", "rain", "star"][i % 4] }));

  console.log("5. Accès : membre du foyer, non-membre, clé API invalide");
  const created = await api(bob, "POST", "/api/kids/trackers", {
    profileId: P, label: "Repas", icon: "cake", kind: "single", options: choices("Tout", "Un peu", "Rien"),
  });
  check(created.status === 201 && created.json?.options?.length === 3, `un membre crée une rubrique (${created.status})`);
  const repas = created.json;
  const row = await prisma.kidTracker.findUnique({ where: { id: repas.id } });
  check(row?.createdById === bob.id && row?.profileId === P, "la rubrique appartient à l'enfant ; son créateur est noté");
  const unauth = await api(null, "GET", `/api/kids/trackers?profileId=${P}`);
  check(unauth.status === 401, `sans clé : 401 (${unauth.status})`);
  const bad = await api({ key: "test-pas-une-cle" }, "GET", `/api/kids/trackers?profileId=${P}`);
  check(bad.status === 401, `clé inconnue : 401 (${bad.status})`);

  const before = await prisma.kidTracker.count();
  const attempts = {
    "GET trackers": await api(carol, "GET", `/api/kids/trackers?profileId=${P}&all=1`),
    "POST trackers": await api(carol, "POST", "/api/kids/trackers", { profileId: P, label: "Intrus", icon: "star", kind: "count" }),
    "PATCH tracker": await api(carol, "PATCH", `/api/kids/trackers/${repas.id}`, { label: "Piraté" }),
    "DELETE tracker": await api(carol, "DELETE", `/api/kids/trackers/${repas.id}`),
    "PUT order": await api(carol, "PUT", "/api/kids/trackers/order", { profileId: P, ids: [repas.id] }),
    "GET week": await api(carol, "GET", `/api/kids/week?profileId=${P}&from=2026-10-05&to=2026-10-11`),
    "PATCH day": await api(carol, "PATCH", "/api/kids/day", { profileId: P, date: "2026-10-05", values: { Repas: "Tout" } }),
    "GET legacy": await api(carol, "GET", `/api/kids?profileId=${P}&from=2026-10-05&to=2026-10-11`),
  };
  for (const [name, r] of Object.entries(attempts)) check(r.status === 404, `non-membre : ${name} → 404 (${r.status})`);
  check((await prisma.kidTracker.count()) === before, "le non-membre n'a rien créé");
  check((await prisma.kidTracker.findUnique({ where: { id: repas.id } })).label === "Repas", "ni modifié la rubrique");
  const wrongProfile = await api(bob, "GET", `/api/kids/trackers?profileId=${other.id}`);
  check(wrongProfile.status === 404, `un membre n'accède pas à l'enfant d'un autre foyer (${wrongProfile.status})`);
  const missing = await api(bob, "GET", "/api/kids/trackers");
  check(missing.status === 400, `profileId manquant : 400 (${missing.status})`);

  console.log("6. Validation des rubriques et des images");
  const badIcon = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "X", icon: "pill", kind: "count" });
  check(badIcon.status === 400 && badIcon.json?.accepted?.length === ICON_COUNT, `image hors bibliothèque refusée, liste des ${ICON_COUNT} renvoyée (${badIcon.status})`);
  for (const icon of ["thermometer", "toilet", "diaper", "nap", "../../etc", 42, null]) {
    const r = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "X", icon, kind: "count" });
    check(r.status === 400, `icône ${JSON.stringify(icon)} refusée (${r.status})`);
  }
  const badOptIcon = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "Y", icon: "star", kind: "single", options: [{ label: "a", icon: "syringe" }] });
  check(badOptIcon.status === 400, `image d'un choix hors bibliothèque refusée (${badOptIcon.status})`);
  const long = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "x".repeat(31), icon: "star", kind: "count" });
  check(long.status === 400, `libellé de 31 caractères refusé (${long.status})`);
  const empty = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "   ", icon: "star", kind: "count" });
  check(empty.status === 400, `libellé vide refusé (${empty.status})`);
  const badKind = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "Z", icon: "star", kind: "free-text" });
  check(badKind.status === 400, `type inconnu (texte libre) refusé (${badKind.status})`);
  const noOpt = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "Z", icon: "star", kind: "multi", options: [] });
  check(noOpt.status === 400, `rubrique à choix sans choix refusée (${noOpt.status})`);
  const dup = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: " REPAS ", icon: "star", kind: "count" });
  check(dup.status === 409, `libellé déjà pris (casse, espaces) refusé (${dup.status})`);
  const dupOpt = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "D", icon: "star", kind: "single", options: choices("Oui", "oui") });
  check(dupOpt.status === 409, `deux choix au même libellé refusés (${dupOpt.status})`);
  const countOpts = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "C", icon: "star", kind: "count", options: choices("a") });
  check(countOpts.status === 400, `un compteur n'a pas de choix (${countOpts.status})`);
  const tooMany = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "M", icon: "star", kind: "multi", options: choices(...Array.from({ length: 17 }, (_, i) => `c${i}`)) });
  check(tooMany.status === 400, `17 choix refusés (${tooMany.status})`);
  const water = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "Verres d'eau", icon: "cup", kind: "count" });
  const loisirs = await api(alice, "POST", "/api/kids/trackers", {
    profileId: P, label: "Sorties", icon: "tree", kind: "multi", options: choices("Parc", "Piscine", "Courses"),
  });
  check(water.status === 201 && loisirs.status === 201, "compteur et rubrique à choix multiples créés");

  console.log("7. Saisie d'une journée");
  const D = "2026-10-12";
  const w1 = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { Repas: "Tout", "Verres d'eau": 3, Sorties: ["parc", "PISCINE"] } });
  check(w1.status === 200, `alice saisit (rubriques par libellé, sans casse) (${w1.status})`);
  check(w1.json?.values[repas.id]?.[0] === repas.options[0].id && w1.json?.values[water.json.id] === 3, "valeurs enregistrées par identifiant");
  const w2 = await api(bob, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { repas: "un peu" } });
  check(w2.status === 200 && w2.json.values[water.json.id] === 3 && w2.json.values[repas.id][0] === repas.options[1].id, "bob corrige Repas ; les autres rubriques du jour ne bougent pas");
  const entry = await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: P, date: D } } });
  check(entry?.userId === alice.id, "l'auteur de la ligne reste celui de la première saisie (ADR 0001)");
  const unknownValue = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { Sorties: ["Judo"] } });
  check(unknownValue.status === 400 && same(unknownValue.json?.accepted, ["Parc", "Piscine", "Courses"]), "valeur inconnue refusée, avec la liste acceptée");
  const unknownTracker = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { Poids: 12 } });
  check(unknownTracker.status === 400 && unknownTracker.json?.accepted?.includes("Repas"), "rubrique inconnue refusée, avec la liste des rubriques");
  const two = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { Repas: ["Tout", "Rien"] } });
  check(two.status === 400, `un choix unique n'accepte pas deux valeurs (${two.status})`);
  for (const v of [100, -1, 1.5, "3"]) {
    const r = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { "Verres d'eau": v } });
    check(r.status === 400, `compteur ${JSON.stringify(v)} refusé (${r.status})`);
  }
  for (const date of ["2026-02-30", "12/10/2026", "", 20261012]) {
    const r = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date, values: { Repas: "Tout" } });
    check(r.status === 400, `date ${JSON.stringify(date)} refusée (${r.status})`);
  }
  const noValues = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: {} });
  check(noValues.status === 400, `values vide refusé (${noValues.status})`);
  const afterBad = await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: P, date: D } } });
  check(same(afterBad.values, entry.values), "aucun refus n'a modifié la journée (écriture atomique)");
  const cleared = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { "Verres d'eau": null } });
  check(cleared.status === 200 && cleared.json.values[water.json.id] === undefined && cleared.json.values[repas.id], "null efface une rubrique, pas les autres");
  const zero = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { "Verres d'eau": 0 } });
  check(zero.status === 200 && zero.json.values[water.json.id] === 0, "un compteur à 0 est une saisie");
  await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: "2026-10-10", values: { Repas: "Rien", Sorties: ["Courses"] } });
  // Bob crée lui-même une ligne (il en est l'auteur) : sert à l'export et au retrait du foyer.
  const bobDay0 = await api(bob, "PATCH", "/api/kids/day", { profileId: P, date: "2026-10-09", values: { Repas: "Rien", "Verres d'eau": 1 } });
  check(bobDay0.status === 200, `bob crée la saisie du 09/10 (${bobDay0.status})`);

  console.log("8. Lecture d'une période");
  const week = await api(bob, "GET", `/api/kids/week?profileId=${P}&from=2026-10-10&to=2026-10-12`);
  check(week.status === 200 && week.json.days.length === 3, `3 jours renvoyés, vides compris (${week.status})`);
  check(week.json.days[1].date === "2026-10-11" && Object.keys(week.json.days[1].values).length === 0, "un jour sans saisie reste visiblement vide");
  check(Array.isArray(week.json.summary?.lines) && week.json.summary.lines.length > 0, `bilan : « ${week.json.summary?.lines?.[0]} »`);
  const month = await api(bob, "GET", `/api/kids/week?profileId=${P}&from=2026-10-01&to=2026-10-31`);
  check(month.status === 200 && month.json.days.length === 31, "31 jours acceptés");
  const tooLong = await api(bob, "GET", `/api/kids/week?profileId=${P}&from=2026-10-01&to=2026-11-01`);
  check(tooLong.status === 400, `32 jours refusés (${tooLong.status})`);
  const inverted = await api(bob, "GET", `/api/kids/week?profileId=${P}&from=2026-10-12&to=2026-10-01`);
  check(inverted.status === 400, `période inversée refusée (${inverted.status})`);

  console.log("9. Masquer plutôt que supprimer");
  const delUsed = await api(alice, "DELETE", `/api/kids/trackers/${repas.id}`);
  check(delUsed.status === 409 && delUsed.json?.code === "has_entries", `supprimer une rubrique qui a des saisies → 409 (${delUsed.status})`);
  check((await prisma.kidTracker.count({ where: { id: repas.id } })) === 1, "…et elle est toujours là");
  const hide = await api(alice, "PATCH", `/api/kids/trackers/${repas.id}`, { active: false });
  check(hide.status === 200 && hide.json.active === false, "la rubrique est masquée");
  const weekHidden = await api(alice, "GET", `/api/kids/week?profileId=${P}&from=2026-10-10&to=2026-10-12`);
  check(!weekHidden.json.trackers.some((t) => t.id === repas.id) && weekHidden.json.days.every((d) => d.values[repas.id] === undefined), "masquée : absente de la semaine, de l'éditeur et du bilan");
  const listHidden = await api(alice, "GET", `/api/kids/trackers?profileId=${P}`);
  check(!listHidden.json.some((t) => t.id === repas.id), "absente de la liste des rubriques actives");
  const listAll = await api(alice, "GET", `/api/kids/trackers?profileId=${P}&all=1`);
  check(listAll.json.some((t) => t.id === repas.id && t.active === false), "visible avec all=1 (réactivable)");
  const writeHidden = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { Repas: "Tout" } });
  check(writeHidden.status === 400 && writeHidden.json?.code === "tracker_hidden", `saisie dans une rubrique masquée refusée (${writeHidden.status})`);
  const show = await api(alice, "PATCH", `/api/kids/trackers/${repas.id}`, { active: true });
  const weekBack = await api(alice, "GET", `/api/kids/week?profileId=${P}&from=2026-10-10&to=2026-10-12`);
  check(show.status === 200 && weekBack.json.days.find((d) => d.date === "2026-10-10").values[repas.id]?.[0] === repas.options[2].id, "réactivée : les saisies passées réapparaissent intactes");

  const spare = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "Jamais utilisée", icon: "bell", kind: "single", options: choices("a", "b") });
  const delUnused = await api(alice, "DELETE", `/api/kids/trackers/${spare.json.id}`);
  check(delUnused.status === 200, `une rubrique sans saisie se supprime (${delUnused.status})`);
  check((await prisma.kidTracker.count({ where: { id: spare.json.id } })) === 0 && (await prisma.kidTrackerOption.count({ where: { trackerId: spare.json.id } })) === 0, "…avec ses choix");

  const sorties = loisirs.json;
  const hideOpt = await api(alice, "PATCH", `/api/kids/trackers/${sorties.id}`, { options: [{ id: sorties.options[0].id, delete: true }, { id: sorties.options[2].id, delete: true }] });
  const optsAfter = Object.fromEntries(hideOpt.json.options.map((o) => [o.label, o.active]));
  check(hideOpt.status === 200 && optsAfter["Parc"] === false && optsAfter["Courses"] === false, "choix avec saisies : « supprimé » = masqué, jamais effacé");
  const parcStillThere = await prisma.kidTrackerOption.count({ where: { id: sorties.options[0].id } });
  check(parcStillThere === 1, "le choix « Parc » (déjà saisi) existe toujours");
  const coursesUsed = await prisma.kidTrackerOption.count({ where: { id: sorties.options[2].id } });
  check(coursesUsed === 1, "le choix « Courses » (déjà saisi le 10/10) est masqué, pas supprimé");
  const piscineUnused = await api(alice, "PATCH", `/api/kids/trackers/${sorties.id}`, { options: [{ label: "Vélo", icon: "bike" }] });
  check(piscineUnused.status === 200 && piscineUnused.json.options.some((o) => o.label === "Vélo"), "un choix s'ajoute");
  const velo = piscineUnused.json.options.find((o) => o.label === "Vélo");
  const delVelo = await api(alice, "PATCH", `/api/kids/trackers/${sorties.id}`, { options: [{ id: velo.id, delete: true }] });
  check(delVelo.status === 200 && !delVelo.json.options.some((o) => o.label === "Vélo") && (await prisma.kidTrackerOption.count({ where: { id: velo.id } })) === 0, "un choix sans saisie se supprime vraiment");
  const hiddenOptWrite = await api(alice, "PATCH", "/api/kids/day", { profileId: P, date: D, values: { Sorties: ["Parc"] } });
  check(hiddenOptWrite.status === 400, `saisie d'un choix masqué refusée (${hiddenOptWrite.status})`);
  const oldWeek = await api(alice, "GET", `/api/kids/week?profileId=${P}&from=2026-10-12&to=2026-10-12`);
  const sortiesDto = oldWeek.json.trackers.find((t) => t.id === sorties.id);
  check(sortiesDto.options.some((o) => o.id === sorties.options[0].id && o.active === false), "la semaine garde le libellé d'un choix masqué (historique lisible)");
  const kindChange = await api(alice, "PATCH", `/api/kids/trackers/${repas.id}`, { kind: "multi" });
  check(kindChange.status === 400, `le type d'une rubrique ne change pas (${kindChange.status})`);

  console.log("10. Ordre, limites, rubriques reprises à renommer");
  const list0 = (await api(alice, "GET", `/api/kids/trackers?profileId=${P}`)).json.map((t) => t.id);
  const reversed = [...list0].reverse();
  const ord = await api(alice, "PUT", "/api/kids/trackers/order", { profileId: P, ids: reversed });
  check(ord.status === 200 && same(ord.json.filter((t) => t.active).map((t) => t.id), reversed), "ordre des rubriques modifié");
  const ordForeign = await api(alice, "PUT", "/api/kids/trackers/order", { profileId: P, ids: [...reversed, "inconnu"] });
  check(ordForeign.status === 400, `identifiant inconnu refusé (${ordForeign.status})`);
  const otherTracker = await prisma.kidTracker.create({ data: { profileId: other.id, label: "Autre", icon: "star", kind: "count" } });
  const ordOther = await api(alice, "PUT", "/api/kids/trackers/order", { profileId: P, ids: [otherTracker.id] });
  check(ordOther.status === 400, `la rubrique d'un autre enfant ne s'ordonne pas ici (${ordOther.status})`);
  const patchOther = await api(alice, "PATCH", `/api/kids/trackers/${otherTracker.id}`, { label: "Piraté" });
  check(patchOther.status === 404, `…ni ne se modifie (${patchOther.status})`);

  let n = (await api(alice, "GET", `/api/kids/trackers?profileId=${P}`)).json.length;
  let last = null;
  for (let i = 0; n + i < 12; i++) last = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: `Rubrique ${i}`, icon: "star", kind: "count" });
  check(last === null || last.status === 201, "jusqu'à 12 rubriques actives");
  const thirteenth = await api(alice, "POST", "/api/kids/trackers", { profileId: P, label: "Une de trop", icon: "star", kind: "count" });
  check(thirteenth.status === 400 && thirteenth.json?.code === "too_many_trackers", `la 13e rubrique active est refusée (${thirteenth.status})`);

  // Rubriques reprises (jeu de données de la reprise).
  const leaTrackers = (await api({ key: s.users.a }, "GET", `/api/kids/trackers?profileId=${s.profiles.lea}&all=1`)).json;
  const goutte = leaTrackers.find((t) => t.label === "Goutte");
  const lune = leaTrackers.find((t) => t.label === "Lune");
  check(goutte.needsRename && lune.needsRename, "Goutte et Lune signalent qu'elles sont à renommer");
  const renamed = await api({ key: s.users.a }, "PATCH", `/api/kids/trackers/${goutte.id}`, { label: "Dents brossées", icon: "check" });
  check(renamed.status === 200 && renamed.json.needsRename === false && renamed.json.label === "Dents brossées", "renommer lève l'indicateur");
  const kept = await api({ key: s.users.a }, "PATCH", `/api/kids/trackers/${lune.id}`, { needsRename: false });
  check(kept.status === 200 && kept.json.needsRename === false && kept.json.label === "Lune", "garder le nom tel quel lève aussi l'indicateur");
  const afterRename = await readableFromDb(s.profiles.lea);
  check(afterRename.byDate["2026-10-05"]["Dents brossées"]?.[0] === "Non" && afterRename.byDate["2026-10-05"]["Lune"]?.[0] === "Oui", "les saisies suivent le nouveau nom");
  // Rejouer la reprise après renommage ne recrée rien (repérage par legacyKey, pas par libellé).
  const lazyAgain = await api({ key: s.users.a }, "GET", `/api/kids/trackers?profileId=${s.profiles.lea}&all=1`);
  check(lazyAgain.json.length === 5, "aucune rubrique recréée après renommage");

  console.log("11. Écritures concurrentes");
  const Dc = "2026-10-13";
  // 1. Première saisie d'un jour inexistant, en parallèle : une seule ligne, aucune erreur.
  const cTrackers = (await api(alice, "GET", `/api/kids/trackers?profileId=${P}`)).json.filter((t) => t.kind === "count").slice(0, 8);
  const burst = await Promise.all(cTrackers.map((t, i) => api(i % 2 ? alice : bob, "PATCH", "/api/kids/day", { profileId: P, date: Dc, values: { [t.id]: i + 1 } })));
  check(burst.every((r) => r.status === 200), `${cTrackers.length} saisies simultanées sur un jour inexistant : toutes acceptées (${burst.map((r) => r.status).join(",")})`);
  const rowsDc = await prisma.kidDayEntry.findMany({ where: { profileId: P, date: Dc } });
  check(rowsDc.length === 1, "une seule ligne pour ce jour");
  const merged = rowsDc[0]?.values ?? {};
  check(cTrackers.every((t, i) => merged[t.id] === i + 1), "aucune saisie perdue : chaque rubrique a la valeur écrite par son appelant");
  // 2. Même rubrique, valeurs différentes : l'une gagne, la valeur reste valide.
  const race = await Promise.all([1, 2, 3, 4, 5, 6].map((v, i) => api(i % 2 ? alice : bob, "PATCH", "/api/kids/day", { profileId: P, date: Dc, values: { [cTrackers[0].id]: v * 10 } })));
  const finalV = (await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: P, date: Dc } } })).values[cTrackers[0].id];
  check(race.every((r) => r.status === 200) && [10, 20, 30, 40, 50, 60].includes(finalV), `même rubrique en parallèle : une valeur écrite entière (${finalV})`);
  const afterRace = (await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: P, date: Dc } } })).values;
  check(cTrackers.slice(1).every((t, i) => afterRace[t.id] === i + 2), "…et les autres rubriques ne bougent pas");
  // 3. Masquage et saisie en parallèle : jamais d'état incohérent (valeur conservée, rubrique masquée ou saisie refusée).
  const target = cTrackers[2];
  const [h, wv] = await Promise.all([
    api(alice, "PATCH", `/api/kids/trackers/${target.id}`, { active: false }),
    api(bob, "PATCH", "/api/kids/day", { profileId: P, date: Dc, values: { [target.id]: 77 } }),
  ]);
  const fin = await prisma.kidTracker.findUnique({ where: { id: target.id } });
  check(h.status === 200 && fin.active === false && (wv.status === 200 || wv.status === 400), `masquage et saisie simultanés : rubrique masquée, saisie ${wv.status === 200 ? "passée avant" : "refusée"}`);
  const valueAfter = (await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: P, date: Dc } } })).values[target.id];
  check(valueAfter === 77 || valueAfter === 3, "la valeur existante n'est ni perdue ni corrompue");
  // 4. Deux créations de la 12e rubrique : une seule passe.
  const slots = 12 - (await api(alice, "GET", `/api/kids/trackers?profileId=${P}`)).json.length;
  const makers = await Promise.all(Array.from({ length: slots + 3 }, (_, i) => api(i % 2 ? alice : bob, "POST", "/api/kids/trackers", { profileId: P, label: `Course ${i}`, icon: "star", kind: "count" })));
  const okCount = makers.filter((r) => r.status === 201).length;
  check(okCount === slots, `créations simultanées : exactement ${slots} acceptées, la limite de 12 tient (${okCount})`);
  check((await prisma.kidTracker.count({ where: { profileId: P, active: true } })) <= 12, "jamais plus de 12 rubriques actives");

  console.log("12. Ancienne route PATCH /api/kids");
  const legacyBefore = await rawEntries(s.profiles.lea);
  const old = await api({ key: s.users.a }, "PATCH", "/api/kids", { profileId: s.profiles.lea, date: "2026-10-05", weather: "stormy" });
  check(old.status === 409 && /recharge/i.test(old.json?.error || ""), `l'ancien PATCH renvoie 409 « recharge la page » (${old.status})`);
  const oldNoAuth = await api(null, "PATCH", "/api/kids", { profileId: s.profiles.lea, date: "2026-10-05", weather: "stormy" });
  check(oldNoAuth.status === 401, `sans clé : 401 (${oldNoAuth.status})`);
  const oldNew = await api({ key: s.users.a }, "PATCH", "/api/kids", { profileId: s.profiles.lea, date: "2026-12-25", weather: "snowy" });
  const legacyAfter = await rawEntries(s.profiles.lea);
  check(same(legacyBefore.map((r) => [r.id, r.weather, r.updatedAt]), legacyAfter.map((r) => [r.id, r.weather, r.updatedAt])) && oldNew.status === 409, "aucune colonne d'origine n'a été écrite, aucune ligne créée");
  const oldGet = await api({ key: s.users.a }, "GET", `/api/kids?profileId=${s.profiles.lea}&from=2026-10-01&to=2026-10-31`);
  check(oldGet.status === 200 && Array.isArray(oldGet.json), "la lecture de l'ancienne route reste disponible (onglets ouverts)");

  console.log("13. Membre retiré du foyer : exception à l'ADR 0001 (le semainier appartient à l'enfant)");
  // Documenté dans l'ADR 0002 : l'enfant appartient au foyer ; qui le quitte perd l'accès à ce
  // qu'il a rempli. Rien n'est supprimé ni réattribué, et ses autres éléments restent à lui.
  const bobRecipe = await api(bob, "POST", "/api/recipes", { title: `Recette de Bob ${run}`, groupId: alice.defaultGroupId, steps: [] });
  const bobEntries = await prisma.kidDayEntry.count({ where: { profileId: P, userId: bob.id } });
  const aliceValuesBefore = (await api(alice, "GET", `/api/kids/week?profileId=${P}&from=2026-10-10&to=2026-10-13`)).json.days;
  const removed = await api(alice, "DELETE", `/api/groups/${alice.defaultGroupId}/members/${bob.id}`);
  check(removed.status === 200, `Bob est retiré du foyer (${removed.status})`);
  const bobWeek = await api(bob, "GET", `/api/kids/week?profileId=${P}&from=2026-10-10&to=2026-10-13`);
  const bobDay = await api(bob, "PATCH", "/api/kids/day", { profileId: P, date: Dc, values: { [cTrackers[0].id]: 1 } });
  const bobList = await api(bob, "GET", `/api/kids/trackers?profileId=${P}`);
  check(bobWeek.status === 404 && bobDay.status === 404 && bobList.status === 404, "Bob n'a plus accès au semainier de l'enfant (404 partout)");
  check((await prisma.kidDayEntry.count({ where: { profileId: P, userId: bob.id } })) === bobEntries, "ses saisies ne sont ni supprimées ni réattribuées");
  const aliceValuesAfter = (await api(alice, "GET", `/api/kids/week?profileId=${P}&from=2026-10-10&to=2026-10-13`)).json.days;
  check(same(aliceValuesBefore, aliceValuesAfter), "Alice voit toujours tout ce que Bob avait saisi");
  const bobRecipeId = bobRecipe.json?.id;
  const bobOwn = await api(bob, "GET", `/api/recipes/${bobRecipeId}`);
  check(bobOwn.status === 200, `ADR 0001 intact pour le reste : Bob voit toujours sa recette (${bobOwn.status})`);
  const bobHome = await api(bob, "POST", "/api/kids/trackers", { profileId: P, label: "Retour", icon: "star", kind: "count" });
  check(bobHome.status === 404, `Bob ne peut plus créer de rubrique pour cet enfant (${bobHome.status})`);
  await prisma.groupMember.create({ data: { groupId: alice.defaultGroupId, userId: bob.id } });
  const bobBack = await api(bob, "GET", `/api/kids/week?profileId=${P}&from=2026-10-10&to=2026-10-13`);
  check(bobBack.status === 200 && same(bobBack.json.days, aliceValuesAfter), "de retour dans le foyer, Bob retrouve exactement la même semaine");

  console.log("14. Export RGPD et suppression de compte");
  const { exportUserData, deleteUserAccount } = await import("../src/lib/account.ts");
  const exp = await exportUserData(bob.id);
  const bobExported = exp.user.kidDayEntries.find((e) => e.date === "2026-10-09");
  check(!!bobExported && sorted(bobExported.readableValues) === sorted({ Repas: ["Rien"], "Verres d'eau": 1 }), "export : la saisie de Bob est là, en clair (« Repas : Rien », « Verres d'eau : 1 »)");
  check(exp.user.kidTrackers.some((t) => t.label === "Repas" && t.options.length === 3), "export : rubriques et choix de l'enfant concerné");
  check(exp.user.kidDayEntries.every((e) => e.readableValues !== undefined), "export : chaque saisie a ses valeurs en clair");
  const legacyExport = (await exportUserData(s.userIds.a)).user.kidDayEntries.find((e) => e.date === "2026-10-05" && e.profile?.id === s.profiles.lea);
  check(!!legacyExport && legacyExport.weather === "sunny" && legacyExport.readableValues["Météo"]?.[0] === "Soleil", "export : une saisie reprise garde ses colonnes d'origine et ses valeurs en clair");

  const eve = await makeUser(run, "eve");
  const frank = await makeUser(run, "frank");
  await prisma.groupMember.createMany({ data: [{ groupId: alice.defaultGroupId, userId: eve.id }, { groupId: alice.defaultGroupId, userId: frank.id }] });
  // 12 rubriques actives : on en masque une pour qu'Eve puisse en créer une.
  const spareToHide = (await api(alice, "GET", `/api/kids/trackers?profileId=${P}`)).json.find((t) => /^Course |^Rubrique /.test(t.label));
  await api(alice, "PATCH", `/api/kids/trackers/${spareToHide.id}`, { active: false });
  const eveTracker = await api(eve, "POST", "/api/kids/trackers", { profileId: P, label: "Créée par Eve", icon: "heart", kind: "count" });
  await api(eve, "PATCH", "/api/kids/day", { profileId: P, date: "2026-09-20", values: { "Créée par Eve": 4 } });
  await api(frank, "PATCH", "/api/kids/day", { profileId: P, date: "2026-09-21", values: { "Verres d'eau": 2 } });
  check(eveTracker.status === 201, `Eve crée une rubrique (${eveTracker.status})`);
  const keep = await deleteUserAccount(eve.id, { keepShared: true });
  const eveRow = await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: P, date: "2026-09-20" } } });
  check(keep && eveRow?.userId === alice.id && eveRow.values[eveTracker.json.id] === 4, "suppression avec « garder le partagé » : la saisie passe au propriétaire du foyer, valeurs intactes");
  const eveTrackerRow = await prisma.kidTracker.findUnique({ where: { id: eveTracker.json.id } });
  check(!!eveTrackerRow && eveTrackerRow.createdById === null, "la rubrique créée par Eve reste à l'enfant (créateur effacé)");
  await deleteUserAccount(frank.id, { keepShared: false });
  const frankRow = await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: P, date: "2026-09-21" } } });
  check(frankRow?.userId === alice.id, "suppression sans « garder le partagé » : la saisie du semainier passe quand même au propriétaire (ADR 0002, le groupe survit)");
  check((await prisma.kidTracker.count({ where: { profileId: P } })) > 0, "…mais les rubriques de l'enfant restent");

  console.log("15. Suppression du profil de l'enfant");
  const delKid = await api(alice, "DELETE", `/api/profiles/${P}`);
  check(delKid.status === 200, `l'enfant est retiré du foyer (${delKid.status})`);
  check(
    (await prisma.kidTracker.count({ where: { profileId: P } })) === 0 &&
      (await prisma.kidDayEntry.count({ where: { profileId: P } })) === 0 &&
      Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM "KidTrackerOption" o LEFT JOIN "KidTracker" t ON t.id = o."trackerId" WHERE t.id IS NULL`)[0].n) === 0,
    "rubriques, choix et saisies partent avec le profil (le semainier appartient à l'enfant)"
  );

  console.log("16. Corrections de revue : transfert du semainier, plafonds, caractères invisibles, verrous");
  const { normalizeKidKey } = await import("../src/lib/kidWeek.ts");
  const olga = await makeUser(run, "olga");
  const ines = await makeUser(run, "ines");
  const maxi = await makeUser(run, "maxi");
  await prisma.groupMember.createMany({ data: [{ groupId: olga.defaultGroupId, userId: ines.id }, { groupId: olga.defaultGroupId, userId: maxi.id }] });
  const Q = (await prisma.familyProfile.create({ data: { groupId: olga.defaultGroupId, name: "Sacha", kind: "child", position: 0 } })).id;
  const humeur = await api(olga, "POST", "/api/kids/trackers", { profileId: Q, label: "Humeur", icon: "face-happy", kind: "single", options: choices("Content", "Bof") });
  const eau = await api(olga, "POST", "/api/kids/trackers", { profileId: Q, label: "Eau", icon: "cup", kind: "count" });
  check(humeur.status === 201 && eau.status === 201, "rubriques de test créées");

  // (secops 1) La ligne du jour appartient à son premier auteur, mais d'autres parents la complètent.
  await api(ines, "PATCH", "/api/kids/day", { profileId: Q, date: "2026-11-02", values: { Humeur: "Content" } });
  await api(maxi, "PATCH", "/api/kids/day", { profileId: Q, date: "2026-11-02", values: { Eau: 2 } });
  await api(ines, "PATCH", "/api/kids/day", { profileId: Q, date: "2026-11-03", values: { Eau: 5 } });
  const inesRecipe = await api(ines, "POST", "/api/recipes", { title: `Recette d'Ines ${run}`, groupId: olga.defaultGroupId, steps: [] });
  check((await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: Q, date: "2026-11-02" } } }))?.userId === ines.id, "la ligne du 2 novembre appartient à Ines (première auteure), Maxi l'a complétée");
  await deleteUserAccount(ines.id, { keepShared: false });
  const d2 = await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: Q, date: "2026-11-02" } } });
  const d3 = await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: Q, date: "2026-11-03" } } });
  check(d2?.userId === olga.id && d2.values[humeur.json.id]?.length === 1 && d2.values[eau.json.id] === 2, "keepShared=false : le jour complété par Maxi est conservé en entier, transféré à la propriétaire du foyer");
  check(d3?.userId === olga.id && d3.values[eau.json.id] === 5, "keepShared=false : la saisie seule d'Ines est aussi transférée (le semainier appartient à l'enfant)");
  const maxiWeek = await api(maxi, "GET", `/api/kids/week?profileId=${Q}&from=2026-11-01&to=2026-11-05`);
  check(maxiWeek.status === 200 && maxiWeek.json.days.find((d) => d.date === "2026-11-02")?.values[eau.json.id] === 2, "les autres parents voient toujours le jour");
  check(inesRecipe.status === 201 && (await prisma.recipe.count({ where: { title: `Recette d'Ines ${run}` } })) === 0, "ADR 0001 intact ailleurs : sa recette de groupe suit toujours keepShared=false");

  // Propriétaire supprimée, groupe qui survit : les saisies vont à l'héritier.
  await api(olga, "PATCH", "/api/kids/day", { profileId: Q, date: "2026-11-04", values: { Eau: 1 } });

  // Groupe qui disparaît (personne d'autre) : comportement actuel, le semainier part avec lui.
  const solo = await makeUser(run, "solo");
  const R = (await prisma.familyProfile.create({ data: { groupId: solo.defaultGroupId, name: "Enfant seul", kind: "child", position: 0 } })).id;
  await prisma.kidTracker.create({ data: { profileId: R, label: "Eau", icon: "cup", kind: "count" } });
  await api(solo, "PATCH", "/api/kids/day", { profileId: R, date: "2026-11-02", values: { Eau: 3 } });
  await deleteUserAccount(solo.id, { keepShared: false });
  check((await prisma.kidDayEntry.count({ where: { profileId: R } })) === 0 && (await prisma.familyProfile.count({ where: { id: R } })) === 0, "groupe sans autre membre : il disparaît avec le semainier de l'enfant (comportement inchangé)");

  // (secops 4) Caractères invisibles : même règle pour le nettoyage et la comparaison.
  console.log("   caractères invisibles");
  check(["⁠", "­", "﻿", "؜", "​", "⁤"].every((c) => normalizeKidKey(`Hu${c}meur`) === normalizeKidKey("Humeur")), "normalizeKidKey : « Hu⁠meur » (U+2060, U+00AD, U+FEFF, U+061C, U+200B, U+2064) vaut « Humeur »");
  for (const c of ["⁠", "­", "﻿", "؜"]) {
    const r = await api(olga, "POST", "/api/kids/trackers", { profileId: Q, label: `Hu${c}meur`, icon: "star", kind: "count" });
    check(r.status === 409 && r.json?.code === "duplicate_label", `« Hu+U+${c.codePointAt(0).toString(16).toUpperCase()}+meur » : doublon détecté (${r.status})`);
  }
  const soft = await api(olga, "POST", "/api/kids/trackers", { profileId: Q, label: "Ca­lme", icon: "star", kind: "count" });
  check(soft.status === 201 && soft.json?.label === "Calme", `le libellé enregistré est nettoyé (« ${soft.json?.label} »)`);
  const viaKey = await api(olga, "PATCH", "/api/kids/day", { profileId: Q, date: "2026-11-05", values: { "Hu⁠meur": "Con­tent" } });
  check(viaKey.status === 200 && viaKey.json?.values[humeur.json.id]?.length === 1, `une rubrique et un choix se désignent aussi avec des caractères invisibles (${viaKey.status})`);
  const dupInvisible = await api(olga, "POST", "/api/kids/trackers", { profileId: Q, label: "Dup", icon: "star", kind: "single", options: [{ label: "Oui", icon: "star" }, { label: "O‍ui", icon: "star" }] });
  check(dupInvisible.status === 409, `deux choix qui ne diffèrent que par un caractère invisible : refusés (${dupInvisible.status})`);

  // (secops 3) Plafonds au total, masquées comprises.
  console.log("   plafonds");
  const Q2 = (await prisma.familyProfile.create({ data: { groupId: olga.defaultGroupId, name: "Plafond", kind: "child", position: 1 } })).id;
  await prisma.kidTracker.createMany({
    data: Array.from({ length: 40 }, (_, i) => ({ profileId: Q2, label: `R${i}`, icon: "star", kind: "count", position: i, active: i < 3 })),
  });
  const over = await api(olga, "POST", "/api/kids/trackers", { profileId: Q2, label: "Quarante et une", icon: "star", kind: "count" });
  check(over.status === 400 && over.json?.code === "too_many_trackers", `40 rubriques dont 37 masquées : la 41e est refusée (${over.status})`);
  const hiddenId = (await prisma.kidTracker.findFirst({ where: { profileId: Q2, label: "R10" } })).id;
  const del = await api(olga, "DELETE", `/api/kids/trackers/${hiddenId}`);
  const again = await api(olga, "POST", "/api/kids/trackers", { profileId: Q2, label: "Quarante et une", icon: "star", kind: "count" });
  check(del.status === 200 && again.status === 201, `supprimer une rubrique masquée sans saisie libère une place (${del.status}, ${again.status})`);
  const opts41 = await api(olga, "POST", "/api/kids/trackers", { profileId: Q, label: "Choix", icon: "star", kind: "multi", options: choices(...Array.from({ length: 41 }, (_, i) => `choix ${i}`)) });
  check(opts41.status === 400 && opts41.json?.code === "too_many_options", `41 choix à la création : refusés (${opts41.status})`);
  const patch41 = await api(olga, "PATCH", `/api/kids/trackers/${humeur.json.id}`, { options: Array.from({ length: 41 }, (_, i) => ({ label: `n${i}`, icon: "star" })) });
  check(patch41.status === 400, `41 choix d'un coup à la modification : refusés (${patch41.status})`);

  // (secops 2, reviewer, secops : verrous) Suppression de compte, lecture et saisie en même temps sur un
  // semainier dont 60 lignes attendent la reprise : pas d'interblocage (40P01), rien de perdu.
  console.log("   verrous : suppression de compte contre reprise et saisies");
  for (let round = 0; round < 3; round++) {
    const owner = await makeUser(run, `lk${round}o`);
    const author = await makeUser(run, `lk${round}a`);
    const peer = await makeUser(run, `lk${round}p`);
    await prisma.groupMember.createMany({ data: [{ groupId: owner.defaultGroupId, userId: author.id }, { groupId: owner.defaultGroupId, userId: peer.id }] });
    const K = (await prisma.familyProfile.create({ data: { groupId: owner.defaultGroupId, name: `Verrou ${round}`, kind: "child", position: 0 } })).id;
    for (let i = 0; i < 60; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      await prisma.$executeRaw`
        INSERT INTO "KidDayEntry" (id, date, weather, mood, activities, "createdAt", "updatedAt", "userId", "profileId")
        VALUES (${"kde" + randomBytes(8).toString("hex")}, ${date}, 'sunny', 'happy', '["park"]', now(), now(), ${author.id}, ${K})`;
    }
    const settled = await Promise.allSettled([
      deleteUserAccount(author.id, { keepShared: false }),
      api(peer, "GET", `/api/kids/week?profileId=${K}&from=2026-01-01&to=2026-01-31`),
      api(owner, "GET", `/api/kids/trackers?profileId=${K}&all=1`),
      api(peer, "PATCH", "/api/kids/day", { profileId: K, date: "2026-06-01", values: { Humeur: "Content" } }),
      api(owner, "POST", "/api/kids/trackers", { profileId: K, label: "Autre", icon: "star", kind: "count" }),
    ]);
    const statuses = settled.map((r) => (r.status === "fulfilled" ? (typeof r.value === "object" && r.value ? r.value.status ?? r.value : r.value) : "rejected"));
    check(settled.every((r) => r.status === "fulfilled") && settled[0].value === true && settled.slice(1).every((r) => [200, 201].includes(r.value.status)), `tour ${round + 1} : aucun interblocage ni erreur (${statuses.join(", ")})`);
    const rows = await prisma.kidDayEntry.findMany({ where: { profileId: K }, select: { userId: true, values: true } });
    check(rows.length === 61 && rows.every((r) => r.userId !== author.id && r.values !== null), `tour ${round + 1} : 61 lignes conservées, aucune à l'auteure supprimée, toutes reprises (${rows.length})`);
  }

  // Propriétaire supprimée avec keepShared=false : le groupe survit chez Maxi, qui reçoit ses saisies.
  await deleteUserAccount(olga.id, { keepShared: false });
  const d4 = await prisma.kidDayEntry.findUnique({ where: { profileId_date: { profileId: Q, date: "2026-11-04" } } });
  check(d4?.userId === maxi.id && d4.values[eau.json.id] === 1, "propriétaire supprimée, groupe repris par Maxi : ses saisies du semainier passent à Maxi");
  const maxiAfter = await api(maxi, "GET", `/api/kids/week?profileId=${Q}&from=2026-11-01&to=2026-11-05`);
  check(maxiAfter.status === 200 && maxiAfter.json.days.filter((d) => Object.keys(d.values).length > 0).length >= 3, "…et le jour reste visible pour le foyer");
  console.log(`\n${checks - failures}/${checks} vérifications OK (phase api)`);
}

try {
  if (phase === "seed") await seed();
  else if (phase === "migrated") await migrated();
  else if (phase === "lazy") await lazy();
  else if (phase === "verify") await verify();
  else if (phase === "snapshot") await snapshot();
  else if (phase === "isolation-seed") await isolationSeed();
  else if (phase === "isolation-failed") await isolationCheck("failed");
  else if (phase === "isolation-retry") await isolationCheck("retry");
  else if (phase === "api") await apiPhase();
  else throw new Error(`phase inconnue : ${phase}`);
} catch (e) {
  failures++;
  console.error("Erreur :", e);
} finally {
  await prisma.$disconnect();
}
if (phase !== "snapshot") console.log(`[${phase}] ${checks - failures}/${checks} vérifications OK`);
if (failures > 0) {
  console.error(`ÉCHEC (${phase}) : ${failures} vérification(s) en erreur.`);
  process.exit(1);
}
