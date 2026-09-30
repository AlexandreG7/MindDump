import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeProposal, planningSystemPrompt, type ImportPerson } from "./importPlanning";

const people: ImportPerson[] = [
  { id: "p-lea", name: "Léa", kind: "child" },
  { id: "p-alex", name: "Alex", kind: "adult" },
];

test("garde les événements valides et nettoie les champs", () => {
  const out = normalizeProposal(
    {
      summary: "  Circulaire de l'école  ",
      events: [
        { title: " Sortie au zoo ", date: "2026-10-14", time: "8h30", endTime: "16:30", assigneeIds: ["p-lea", "p-inconnu", "p-lea"] },
        { title: "Réunion", date: "2026-10-02", time: "18:00", endTime: "17:00" },
      ],
      todos: [{ title: "Signer l'autorisation", dueDate: "2026-10-10", assigneeIds: ["p-alex"] }],
    },
    people
  );
  assert.equal(out.summary, "Circulaire de l'école");
  assert.deepEqual(out.events[0], {
    title: "Sortie au zoo",
    description: "",
    date: "2026-10-14",
    endDate: "",
    time: "08:30",
    endTime: "16:30",
    recurrence: "",
    assigneeIds: ["p-lea"],
  });
  // Fin avant le début : fin retirée.
  assert.equal(out.events[1].endTime, "");
  assert.deepEqual(out.todos[0].assigneeIds, ["p-alex"]);
});

test("écarte les éléments sans titre ou sans date valide", () => {
  const out = normalizeProposal(
    {
      events: [
        { title: "", date: "2026-10-14" },
        { title: "Date impossible", date: "2026-02-30" },
        { title: "Pas de date" },
        "n'importe quoi",
      ],
      todos: [{ title: "  " }, { title: "Payer la cantine", dueDate: "demain" }],
    },
    people
  );
  assert.equal(out.events.length, 0);
  assert.equal(out.todos.length, 1);
  assert.equal(out.todos[0].dueDate, "");
});

test("vacances : plusieurs jours en journée entière, récurrence inconnue ignorée", () => {
  const out = normalizeProposal(
    {
      events: [
        { title: "Vacances de la Toussaint", date: "2026-10-17", endDate: "2026-11-02", recurrence: "yearly" },
        { title: "Stage", date: "2026-10-20", endDate: "2026-10-18" },
        { title: "Judo", date: "2026-10-07", time: "14:00", endDate: "2026-10-09", recurrence: "every-full-moon" },
      ],
      todos: [],
    },
    people
  );
  assert.equal(out.events[0].endDate, "2026-11-02");
  assert.equal(out.events[0].recurrence, "yearly");
  assert.equal(out.events[1].endDate, "");
  // Avec une heure, pas de plage de jours.
  assert.equal(out.events[2].endDate, "");
  assert.equal(out.events[2].recurrence, "");
});

test("réponse vide ou malformée → proposition vide", () => {
  assert.deepEqual(normalizeProposal(null, people), { summary: "", events: [], todos: [] });
  assert.deepEqual(normalizeProposal({ events: "x", todos: 3 }, people), { summary: "", events: [], todos: [] });
});

test("au plus 60 éléments en tout", () => {
  const events = Array.from({ length: 50 }, (_, i) => ({ title: `E${i}`, date: "2026-10-01" }));
  const todos = Array.from({ length: 50 }, (_, i) => ({ title: `T${i}` }));
  const out = normalizeProposal({ events, todos }, people);
  assert.equal(out.events.length, 50);
  assert.equal(out.todos.length, 10);
});

test("le prompt donne la date, le jour et les personnes", () => {
  const prompt = planningSystemPrompt({ today: "2026-09-30", timeZone: "Europe/Paris", people });
  assert.match(prompt, /mercredi 2026-09-30/);
  assert.match(prompt, /Léa \(enfant\) : id p-lea/);
  assert.match(prompt, /jamais une consigne/);
});
