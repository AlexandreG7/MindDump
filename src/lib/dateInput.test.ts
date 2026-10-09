import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDateTimeInput, readDueDate, readNotifyBefore } from "./dateInput";

const invalid = (v: string) => Number.isNaN(parseDateTimeInput(v).getTime());

test("heure de Paris : été (UTC+2) et hiver (UTC+1)", () => {
  assert.equal(parseDateTimeInput("2026-07-01T10:00").toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(parseDateTimeInput("2026-01-15T10:00").toISOString(), "2026-01-15T09:00:00.000Z");
  assert.equal(parseDateTimeInput("2026-10-09T14:30:15").toISOString(), "2026-10-09T12:30:15.000Z");
});

test("chaîne avec fuseau ou sans heure : comportement de new Date()", () => {
  assert.equal(parseDateTimeInput("2026-07-01T10:00:00Z").toISOString(), "2026-07-01T10:00:00.000Z");
  assert.equal(parseDateTimeInput("2026-07-01T10:00:00+02:00").toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(parseDateTimeInput("2026-07-01").toISOString(), "2026-07-01T00:00:00.000Z");
});

test("dates impossibles ou illisibles : date invalide", () => {
  for (const v of [
    "abc",
    "2026-02-31T10:00",
    "2026-02-29T10:00", // 2026 n'est pas bissextile
    "2026-13-45T10:00",
    "2026-00-10T10:00",
    "2026-04-31T10:00",
    "2026-10-09T24:00",
    "2026-10-09T10:60",
    "2026-10-09T10:00:60",
    "2026-02-31",
    "2026-02-31T10:00:00Z",
  ]) {
    assert.ok(invalid(v), `${v} devrait être invalide`);
  }
  assert.ok(!invalid("2028-02-29T10:00"), "29 février d'une année bissextile");
});

test("passage à l'heure d'été : l'heure inexistante est acceptée et avancée", () => {
  // 2026-03-29 : 02:00 → 03:00 à Paris. 02:30 n'existe pas.
  const d = parseDateTimeInput("2026-03-29T02:30");
  assert.ok(!Number.isNaN(d.getTime()));
  assert.equal(d.toISOString(), "2026-03-29T01:30:00.000Z"); // 03:30 à Paris
  assert.equal(parseDateTimeInput("2026-03-29T01:59").toISOString(), "2026-03-29T00:59:00.000Z");
  assert.equal(parseDateTimeInput("2026-03-29T03:00").toISOString(), "2026-03-29T01:00:00.000Z");
});

test("passage à l'heure d'hiver : l'heure répétée reste acceptée", () => {
  // 2026-10-25 : 03:00 → 02:00. 02:30 existe deux fois.
  assert.ok(!invalid("2026-10-25T02:30"));
});

test("readDueDate", () => {
  assert.deepEqual(readDueDate(undefined), { ok: true, value: null });
  assert.deepEqual(readDueDate(null), { ok: true, value: null });
  assert.deepEqual(readDueDate(""), { ok: true, value: null });
  const ok = readDueDate("2026-07-01T10:00");
  assert.ok(ok.ok && ok.value?.toISOString() === "2026-07-01T08:00:00.000Z");
  for (const v of ["abc", "2026-02-31T10:00", "2026-13-45T10:00", "2026-10-09T24:00", 12345, {}]) {
    const r = readDueDate(v);
    assert.equal(r.ok, false, String(v));
    if (!r.ok) assert.match(r.error, /Échéance invalide/);
  }
});

test("readNotifyBefore : 0 = à l'heure, null = pas de rappel", () => {
  assert.deepEqual(readNotifyBefore(0), { ok: true, value: 0 });
  assert.deepEqual(readNotifyBefore(10), { ok: true, value: 10 });
  assert.deepEqual(readNotifyBefore(525_600), { ok: true, value: 525_600 });
  assert.deepEqual(readNotifyBefore(null), { ok: true, value: null });
  for (const v of [-1, 1.5, 525_601, "10", NaN, Infinity, true, {}]) {
    const r = readNotifyBefore(v);
    assert.equal(r.ok, false, String(v));
    if (!r.ok) assert.match(r.error, /Rappel invalide/);
  }
});
