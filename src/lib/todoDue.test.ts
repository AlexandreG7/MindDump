import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DUE_TIME, joinDue, localDateTime, splitDue } from "./todoDue";

// Ces tests s'exécutent dans le fuseau du processus (TZ=…) : la date locale
// attendue est reconstruite avec le constructeur à composantes, jamais avec
// une chaîne analysée, pour que le test ne dépende pas du moteur non plus.
const local = (y: number, mo: number, d: number, h: number, mi: number, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s).toISOString();

test("joinDue lit la saisie à l'heure locale de l'appareil", () => {
  assert.equal(joinDue("2026-10-09", "17:05"), local(2026, 10, 9, 17, 5));
  assert.equal(joinDue("2026-01-15", "00:00"), local(2026, 1, 15, 0, 0));
  assert.equal(joinDue("2026-12-31", "23:59"), local(2026, 12, 31, 23, 59));
});

test("joinDue accepte les secondes et les millisecondes d'un champ d'heure", () => {
  assert.equal(joinDue("2026-10-09", "17:05:00"), local(2026, 10, 9, 17, 5));
  assert.equal(joinDue("2026-10-09", "17:05:30"), local(2026, 10, 9, 17, 5, 30));
  assert.equal(joinDue("2026-10-09", "17:05:00.000"), local(2026, 10, 9, 17, 5));
});

test("joinDue : heure vide = heure par défaut, pas de date = null", () => {
  assert.equal(joinDue("2026-10-09", ""), local(2026, 10, 9, 9, 0));
  assert.equal(DEFAULT_DUE_TIME, "09:00");
  assert.equal(joinDue("", "17:05"), null);
});

test("saisie illisible ou impossible : null, jamais une date décalée", () => {
  for (const [d, t] of [
    ["2026-02-31", "10:00"],
    ["2026-13-01", "10:00"],
    ["2026-10-09", "24:00"],
    ["2026-10-09", "10:60"],
    ["2026-10-09", "25:00"],
    ["09/10/2026", "10:00"],
    ["2026-10-09", "10h05"],
    ["2026-10-09", "abc"],
  ]) {
    assert.equal(joinDue(d, t), null, `${d} ${t}`);
    assert.ok(Number.isNaN(localDateTime(d, t).getTime()), `${d} ${t}`);
  }
});

test("splitDue et joinDue sont inverses", () => {
  for (const [date, time] of [
    ["2026-10-09", "17:05"],
    ["2026-07-01", "00:00"],
    ["2026-01-15", "23:59"],
    ["2026-03-29", "12:30"],
    ["2026-10-25", "12:30"],
  ]) {
    assert.deepEqual(splitDue(joinDue(date, time)), { date, time });
  }
});

test("splitDue : vide ou illisible", () => {
  assert.deepEqual(splitDue(null), { date: "", time: "" });
  assert.deepEqual(splitDue(undefined), { date: "", time: "" });
  assert.deepEqual(splitDue("pas une date"), { date: "", time: "" });
});

test("« aujourd'hui + 5 minutes » : le jour et l'heure restent ceux de l'appareil", () => {
  const now = new Date();
  const soon = new Date(now.getTime() + 5 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`;
  const time = `${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
  const joined = new Date(joinDue(date, time)!).getTime();
  // Écart à la minute près avec « maintenant + 5 min », quel que soit le fuseau.
  assert.ok(Math.abs(joined - soon.getTime()) < 60 * 1000);
});
