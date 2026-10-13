/**
 * Test de bout en bout des outils kids_* contre une app locale et une base JETABLE.
 *
 *   DATABASE_URL=postgresql://…/minddump_xxx  MINDDUMP_API_URL=http://localhost:3175 \
 *   KIDS_MCP_TEST=disposable npm run test:kids-integration
 *
 * L'app doit tourner (next start) sur cette même base, migrations appliquées.
 * Le test crée ses utilisateurs, clés API et enfants (aucune suppression).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { client as apiClient } from "./client.js";
import { registerKidTools } from "./tools/kids.js";

const enabled = process.env.KIDS_MCP_TEST === "disposable";
const BASE = process.env.MINDDUMP_API_URL || "";

type Tool = { name: string; description?: string };
const text = (r: unknown) => ((r as { content: Array<{ text: string }> }).content[0].text);
const isError = (r: unknown) => Boolean((r as { isError?: boolean }).isError);

async function api(key: string, method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

test("outils kids_* de bout en bout", { skip: !enabled && "KIDS_MCP_TEST=disposable requis" }, async () => {
  // Le client Prisma vit à la racine du dépôt.
  const require = createRequire(new URL("../../package.json", import.meta.url));
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const run = randomBytes(4).toString("hex");

  async function makeUser(name: string) {
    const key = `test-${run}-${name}-${randomBytes(8).toString("hex")}`;
    const user = await prisma.user.create({
      data: { name, email: `${name}-${run}@test.local`, consentedAt: new Date(), apiKeys: { create: { key } } },
    });
    const group = await prisma.group.create({
      data: { name: `Foyer ${name}`, isDefault: true, ownerId: user.id, members: { create: { userId: user.id, role: "admin" } } },
    });
    const kid = await api(key, "POST", `/api/groups/${group.id}/profiles`, { name: name === "alice" ? "Léa" : "Zoé", kind: "child" });
    assert.equal(kid.status, 201, JSON.stringify(kid.json));
    return { key, kidId: kid.json.id as string, kidName: kid.json.name as string };
  }

  try {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");

    // Rubriques de Léa : Humeur (1 choix), Activités (plusieurs).
    const mood = await api(alice.key, "POST", "/api/kids/trackers", {
      profileId: alice.kidId, label: "Humeur", icon: "sun", kind: "single",
      options: [{ label: "Content", icon: "sun" }, { label: "Fatigué", icon: "moon" }],
    });
    assert.equal(mood.status, 201, JSON.stringify(mood.json));
    const act = await api(alice.key, "POST", "/api/kids/trackers", {
      profileId: alice.kidId, label: "Activités", icon: "star", kind: "multi",
      options: [{ label: "Peinture", icon: "star" }, { label: "Vélo", icon: "sun" }, { label: "Lecture", icon: "moon" }],
    });
    assert.equal(act.status, 201, JSON.stringify(act.json));

    // Serveur MCP en mémoire, branché sur la clé d'Alice.
    const server = new McpServer({ name: "test", version: "0" });
    registerKidTools(server);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(st), mcp.connect(ct)]);
    const setKey = (k: string) => ((apiClient as unknown as { apiKey: string }).apiKey = k);
    const call = (name: string, args: Record<string, unknown>) => mcp.callTool({ name, arguments: args });
    setKey(alice.key);

    // Descriptions : pas de catégorie de santé, rappel des CGU.
    const tools = (await mcp.listTools()).tools as Tool[];
    const kidsTools = tools.filter((t) => t.name.startsWith("kids_"));
    assert.deepEqual(kidsTools.map((t) => t.name).sort(), ["kids_fill_day", "kids_list_trackers", "kids_read_week"]);
    for (const t of kidsTools) {
      assert.match(t.description!, /Ne saisis pas d'informations de santé \(voir les CGU\)\./);
      assert.doesNotMatch(t.description!, /sieste|médicament|symptôme|accident|pipi|maladie|fièvre|sommeil/i);
    }

    // 1. Lister, par prénom sans accent/casse.
    const list = await call("kids_list_trackers", { child: "lea" });
    assert.ok(!isError(list), text(list));
    assert.match(text(list), /Humeur/);
    assert.match(text(list), /Content, Fatigué/);
    assert.match(text(list), /Peinture, Vélo, Lecture/);

    // 2. Saisie par libellés, date fixe.
    const fill = await call("kids_fill_day", {
      child: "Léa", date: "2026-10-12",
      values: { humeur: "content", "ACTIVITES": ["peinture", "velo"] },
    });
    assert.ok(!isError(fill), text(fill));
    assert.match(text(fill), /Humeur : Content/);
    assert.match(text(fill), /Activités : Peinture \+ Vélo/);

    // 3. Écriture partielle : l'humeur ne bouge pas quand on ne cite que les activités.
    const part = await call("kids_fill_day", { child: alice.kidId, date: "2026-10-12", values: { Activités: ["Lecture"] } });
    assert.ok(!isError(part), text(part));
    assert.match(text(part), /Humeur : Content/);
    assert.match(text(part), /Activités : Lecture/);
    assert.doesNotMatch(text(part), /Peinture/);

    // 4. Lecture de la semaine (lundi 12 au dimanche 18 octobre 2026).
    const week = await call("kids_read_week", { child: "Léa", date: "2026-10-14" });
    assert.ok(!isError(week), text(week));
    assert.match(text(week), /du 2026-10-12 au 2026-10-18/);
    assert.match(text(week), /Humeur : Content/);
    assert.match(text(week), /Activités : Lecture/);
    assert.match(text(week), /1 jour\(s\) rempli\(s\)/);

    // Semaine en cours par défaut : pas d'erreur.
    assert.ok(!isError(await call("kids_read_week", { child: "Léa" })));

    // 5. Choix inconnu refusé avec la liste des valeurs acceptées, rien n'est écrit.
    const bad = await call("kids_fill_day", { child: "Léa", date: "2026-10-13", values: { Humeur: "furieux" } });
    assert.ok(isError(bad));
    assert.match(text(bad), /value_unknown/);
    assert.match(text(bad), /Valeurs acceptées : .*Content/);
    assert.match(text(bad), /Fatigué/);
    const after = await api(alice.key, "GET", `/api/kids/week?profileId=${alice.kidId}&from=2026-10-13&to=2026-10-13`);
    assert.deepEqual(after.json.days[0].values, {});

    // Rubrique inconnue : message exploitable aussi.
    const badTracker = await call("kids_fill_day", { child: "Léa", date: "2026-10-13", values: { Météo: "x" } });
    assert.ok(isError(badTracker));
    console.log("rubrique inconnue ->", text(badTracker).replace(/\n/g, " | "));

    // 6. Compteur hors bornes refusé par le schéma de l'outil.
    const huge = await call("kids_fill_day", { child: "Léa", values: { Humeur: "content", Activités: 100 } }).catch((e) => e);
    assert.ok(huge instanceof Error || isError(huge));

    // 7. Enfant d'un autre foyer : introuvable côté outil, 404 côté API.
    const foreign = await call("kids_list_trackers", { child: bob.kidId });
    assert.ok(isError(foreign));
    assert.doesNotMatch(text(foreign), /Zoé/);
    const direct = await api(alice.key, "GET", `/api/kids/trackers?profileId=${bob.kidId}`);
    assert.equal(direct.status, 404);
    const directWrite = await api(alice.key, "PATCH", "/api/kids/day", { profileId: bob.kidId, date: "2026-10-12", values: { Humeur: "x" } });
    assert.equal(directWrite.status, 404);
    // Même en forçant l'identifiant côté client API (outil appelé avec la clé d'Alice sur l'id de Zoé).
    const foreignWeek = await call("kids_read_week", { child: bob.kidId });
    assert.ok(isError(foreignWeek));

    // 8. Bob ne voit pas Léa, et son propre enfant reste lisible.
    setKey(bob.key);
    assert.ok(isError(await call("kids_read_week", { child: alice.kidId })));
    assert.ok(isError(await call("kids_list_trackers", { child: "Léa" })));
    const own = await call("kids_list_trackers", { child: "Zoé" });
    assert.ok(!isError(own));
    assert.match(text(own), /aucune rubrique/);
  } finally {
    await prisma.$disconnect();
  }
});
