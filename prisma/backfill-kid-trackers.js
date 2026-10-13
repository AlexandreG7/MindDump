const { PrismaClient } = require("@prisma/client");
const { LEGACY_SPECS, legacyToValues } = require("./kid-legacy");

/**
 * Reprise de l'ancien semainier (colonnes fixes) vers les rubriques choisies par la
 * famille. Pour chaque enfant qui a au moins une saisie dont `values` est nul, dans
 * une transaction par enfant :
 *   1. crée les rubriques reprises manquantes (Météo, Humeur, Goutte, Lune, Activités,
 *      repérées par legacyKey : jamais en double) ; Goutte et Lune sont masquées si
 *      l'enfant n'a aucune saisie dedans ;
 *   2. convertit chaque ligne en `values`. Les anciennes colonnes ne sont ni modifiées
 *      ni vidées, `updatedAt` et `userId` restent tels quels (ADR 0001).
 * Rejouable sans effet : une ligne déjà reprise n'est plus touchée. Même logique que
 * la lecture tolérante de src/lib/kidTrackers.ts (rubriques et conversion dans
 * prisma/kid-legacy.js), même verrou par enfant que l'API.
 * En cas d'erreur : journal et sortie sans bloquer le démarrage.
 */
async function convertProfile(tx, profileId) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"kids:" + profileId}))`;

  const rows = await tx.$queryRaw`
    SELECT id, weather, mood, nap, accident, activities
    FROM "KidDayEntry" WHERE "profileId" = ${profileId} AND "values" IS NULL`;
  if (rows.length === 0) return { converted: 0, created: 0, unmapped: 0 };

  const existing = await tx.kidTracker.findMany({
    where: { profileId, legacyKey: { not: null } },
    include: { options: true },
  });
  const byKey = new Map(existing.map((t) => [t.legacyKey, t]));

  const counts = await tx.$queryRaw`
    SELECT count(nap) AS nap, count(accident) AS accident FROM "KidDayEntry" WHERE "profileId" = ${profileId}`;
  const hasData = { nap: Number(counts[0].nap) > 0, accident: Number(counts[0].accident) > 0 };

  const top = await tx.kidTracker.aggregate({ where: { profileId }, _max: { position: true } });
  let position = (top._max.position ?? -1) + 1;
  let created = 0;
  for (const spec of LEGACY_SPECS) {
    if (byKey.has(spec.key)) continue;
    const hidden = spec.hideIfEmpty && !hasData[spec.key];
    const tracker = await tx.kidTracker.create({
      data: {
        profileId,
        label: spec.label,
        icon: spec.icon,
        kind: spec.kind,
        position: position++,
        active: !hidden,
        needsRename: !!spec.needsRename,
        legacyKey: spec.key,
        options: {
          create: spec.options.map(([legacyValue, label, icon], i) => ({ label, icon, position: i, legacyValue })),
        },
      },
      include: { options: true },
    });
    byKey.set(spec.key, tracker);
    created++;
  }

  const index = new Map();
  for (const spec of LEGACY_SPECS) {
    const t = byKey.get(spec.key);
    index.set(spec.key, {
      trackerId: t.id,
      options: new Map(t.options.filter((o) => o.legacyValue !== null).map((o) => [o.legacyValue, o.id])),
    });
  }

  let converted = 0;
  let unmapped = 0;
  const reveal = new Set();
  for (const row of rows) {
    const r = legacyToValues(row, index);
    unmapped += r.unmapped;
    for (const key of ["nap", "accident"]) {
      const t = byKey.get(key);
      if (!t.active && r.values[t.id] !== undefined) reveal.add(t.id);
    }
    converted += await tx.$executeRaw`
      UPDATE "KidDayEntry" SET "values" = ${JSON.stringify(r.values)}::jsonb
      WHERE id = ${row.id} AND "values" IS NULL`;
  }
  if (reveal.size > 0) {
    await tx.kidTracker.updateMany({ where: { id: { in: Array.from(reveal) } }, data: { active: true } });
  }
  return { converted, created, unmapped };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const pending = await prisma.$queryRaw`
      SELECT DISTINCT "profileId" FROM "KidDayEntry" WHERE "values" IS NULL AND "profileId" IS NOT NULL`;
    let profiles = 0;
    let converted = 0;
    let created = 0;
    let unmapped = 0;
    for (const { profileId } of pending) {
      const r = await prisma.$transaction((tx) => convertProfile(tx, profileId), { timeout: 60000 });
      profiles++;
      converted += r.converted;
      created += r.created;
      unmapped += r.unmapped;
    }
    if (profiles > 0) {
      console.log(
        `Kid trackers: ${profiles} profile(s), ${created} tracker(s) created, ${converted} entr${converted === 1 ? "y" : "ies"} converted` +
          (unmapped > 0 ? `, ${unmapped} unknown legacy value(s) left in the old columns` : "")
      );
    }
  } catch (e) {
    console.log("backfill-kid-trackers: skipped (" + e.message + ")");
  } finally {
    await prisma.$disconnect();
  }
}

main();
