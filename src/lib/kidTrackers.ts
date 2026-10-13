/**
 * Semainier : rubriques choisies par la famille pour chaque enfant (KidTracker,
 * KidTrackerOption) et saisies par jour (KidDayEntry.values). Bibliothèque serveur
 * unique : l'API (et, par elle, le serveur MCP) valide et écrit ici, nulle part ailleurs.
 *
 * Accès : le semainier appartient au PROFIL de l'enfant, donc à son groupe
 * (findAccessibleProfile). Un membre retiré du groupe perd l'accès à ce qu'il y a
 * saisi : exception assumée à l'ADR 0001, actée dans l'ADR 0002. Aucune saisie
 * n'est ni supprimée ni réattribuée (userId d'une entrée ne change jamais).
 *
 * Concurrence : toute écriture d'un profil prend d'abord le même verrou
 * consultatif (lockProfile), puis les lignes du jour sont lues avec FOR UPDATE.
 *
 * Reprise : tant que les anciennes colonnes (weather, mood, nap, accident,
 * activities) existent, une ligne dont `values` est nul est convertie à la
 * lecture et à l'écriture avec les mêmes rubriques et la même conversion que
 * prisma/backfill-kid-trackers.js (prisma/kid-legacy.js). Le test test:kids vérifie
 * qu'une ligne lue à la volée et la même ligne reprise au démarrage donnent le même
 * résultat. Supprimé avec les colonnes au contract.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { findAccessibleProfile } from "./profiles";
import { isKidIconId, KID_ICON_IDS } from "./kidIconIds";
// Reprise de l'ancien semainier : source unique avec prisma/backfill-kid-trackers.js.
import { LEGACY_SPECS, legacyToValues } from "../../prisma/kid-legacy";
import {
  KID_COUNT_MAX,
  KID_KINDS,
  KID_LABEL_MAX,
  KID_MAX_ACTIVE_OPTIONS,
  KID_MAX_ACTIVE_TRACKERS,
  KID_MAX_OPTIONS_TOTAL,
  KID_MAX_TRACKERS_TOTAL,
  KID_MAX_WEEK_DAYS,
  daysBetween,
  describeValues,
  eachDate,
  isRealDate,
  normalizeKidKey,
  stripInvisible,
  summarizeWeek,
  todayInParis,
  visibleValues,
  type KidDayDto,
  type KidDayValues,
  type KidTrackerDto,
  type KidTrackerKind,
} from "./kidWeek";

type Tx = Prisma.TransactionClient;

/** Plafond de choix au total (masqués compris), pour borner la croissance. */
const MAX_OPTIONS_TOTAL = KID_MAX_OPTIONS_TOTAL;

/** La reprise d'un gros semainier peut dépasser les 5 s par défaut d'une transaction interactive. */
const KID_TX = { timeout: 60_000, maxWait: 10_000 };

function kidTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, KID_TX);
}

// ─── Erreurs ──────────────────────────────────────────────────────────────────

export class KidError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public accepted?: string[]
  ) {
    super(message);
  }
}

/** Réponse HTTP d'une erreur du semainier ; null si l'erreur est autre (à relancer). */
export function kidErrorResponse(e: unknown): NextResponse | null {
  if (!(e instanceof KidError)) return null;
  return NextResponse.json(
    { error: e.message, code: e.code, ...(e.accepted ? { accepted: e.accepted } : {}) },
    { status: e.status }
  );
}

// ─── Accès ────────────────────────────────────────────────────────────────────

/** Le profil, si l'utilisateur est membre de son groupe ; sinon 404 (on ne confirme rien). */
export async function requireKidProfile(profileId: unknown, userId: string) {
  if (typeof profileId !== "string" || !profileId) throw new KidError(400, "profile_required", "profileId requis");
  const profile = await findAccessibleProfile(profileId, userId);
  if (!profile) throw new KidError(404, "not_found", "Profil introuvable");
  return profile;
}

/** Identifiant du profil d'une rubrique, après contrôle d'accès ; 404 sinon. */
export async function requireKidTracker(trackerId: string, userId: string) {
  const tracker = await prisma.kidTracker.findUnique({ where: { id: trackerId }, select: { profileId: true } });
  if (!tracker) throw new KidError(404, "not_found", "Rubrique introuvable");
  try {
    await requireKidProfile(tracker.profileId, userId);
  } catch {
    throw new KidError(404, "not_found", "Rubrique introuvable");
  }
  return tracker.profileId;
}

// ─── Verrou et lecture ────────────────────────────────────────────────────────

/** Sérialise toutes les écritures du semainier d'un enfant (config, saisies, reprise). */
export async function lockProfile(tx: Tx, profileId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"kids:" + profileId}))`;
}

type TrackerRow = Prisma.KidTrackerGetPayload<{ include: { options: true } }>;

function toDto(t: TrackerRow, includeInactiveOptions: boolean): KidTrackerDto {
  return {
    id: t.id,
    profileId: t.profileId,
    label: t.label,
    icon: t.icon,
    kind: t.kind as KidTrackerKind,
    position: t.position,
    active: t.active,
    needsRename: t.needsRename,
    options: t.options
      .filter((o) => includeInactiveOptions || o.active)
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, label: o.label, icon: o.icon, position: o.position, active: o.active })),
  };
}

export async function loadTrackers(
  profileId: string,
  opts: { includeInactive?: boolean; includeInactiveOptions?: boolean } = {},
  db: Tx | typeof prisma = prisma
): Promise<KidTrackerDto[]> {
  const includeInactive = opts.includeInactive ?? false;
  const includeInactiveOptions = opts.includeInactiveOptions ?? includeInactive;
  const rows = await db.kidTracker.findMany({
    where: { profileId, ...(includeInactive ? {} : { active: true }) },
    include: { options: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((r) => toDto(r, includeInactiveOptions));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// ─── Reprise des anciennes colonnes ───────────────────────────────────────────

export type LegacyRow = Parameters<typeof legacyToValues>[0];
type LegacyIndex = Parameters<typeof legacyToValues>[1];

/**
 * Crée les rubriques reprises manquantes de l'enfant et convertit ses lignes dont
 * `values` est nul. Idempotent. Le verrou du profil doit être pris par l'appelant.
 */
async function convertInTx(tx: Tx, profileId: string) {
  const rows = await tx.$queryRaw<Array<LegacyRow & { id: string }>>`
    SELECT id, weather, mood, nap, accident, activities
    FROM "KidDayEntry" WHERE "profileId" = ${profileId} AND "values" IS NULL
    ORDER BY id FOR UPDATE`;
  if (rows.length === 0) return { converted: 0, trackersCreated: 0, unmapped: 0 };

  const existing = await tx.kidTracker.findMany({
    where: { profileId, legacyKey: { not: null } },
    include: { options: true },
  });
  const byKey = new Map(existing.map((t) => [t.legacyKey as string, t]));

  const counts = await tx.$queryRaw<Array<{ nap: bigint; accident: bigint }>>`
    SELECT count(nap) AS nap, count(accident) AS accident FROM "KidDayEntry" WHERE "profileId" = ${profileId}`;
  const hasData = { nap: Number(counts[0].nap) > 0, accident: Number(counts[0].accident) > 0 };

  const top = await tx.kidTracker.aggregate({ where: { profileId }, _max: { position: true } });
  let position = (top._max.position ?? -1) + 1;
  let trackersCreated = 0;
  for (const spec of LEGACY_SPECS) {
    if (byKey.has(spec.key)) continue;
    const hidden = spec.hideIfEmpty && !hasData[spec.key as "nap" | "accident"];
    const created = await tx.kidTracker.create({
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
    byKey.set(spec.key, created);
    trackersCreated++;
  }

  const index: LegacyIndex = new Map();
  for (const spec of LEGACY_SPECS) {
    const t = byKey.get(spec.key)!;
    index.set(spec.key, {
      trackerId: t.id,
      options: new Map(t.options.filter((o) => o.legacyValue !== null).map((o) => [o.legacyValue as string, o.id])),
    });
  }

  let unmapped = 0;
  const reveal = new Set<string>();
  const ids: string[] = [];
  const payloads: string[] = [];
  for (const row of rows) {
    const r = legacyToValues(row, index);
    unmapped += r.unmapped;
    // Une rubrique masquée d'office qui reçoit une saisie (ancienne version encore en ligne) réapparaît.
    for (const key of ["nap", "accident"] as const) {
      const t = byKey.get(key)!;
      if (!t.active && r.values[t.id] !== undefined) reveal.add(t.id);
    }
    ids.push(row.id);
    payloads.push(JSON.stringify(r.values));
  }
  // Un seul UPDATE ensembliste. Les lignes sont déjà verrouillées (SELECT … ORDER BY id FOR UPDATE) :
  // l'ordre de prise des verrous est celui des id, comme dans la suppression de compte
  // (src/lib/account.ts), donc pas d'interblocage. Sans effet sur une ligne déjà reprise.
  const converted = await tx.$executeRaw`
    UPDATE "KidDayEntry" k SET "values" = v.payload::jsonb
    FROM unnest(${ids}::text[], ${payloads}::text[]) AS v(id, payload)
    WHERE k.id = v.id AND k."values" IS NULL`;
  if (reveal.size > 0) {
    await tx.kidTracker.updateMany({ where: { id: { in: Array.from(reveal) } }, data: { active: true } });
  }
  return { converted, trackersCreated, unmapped };
}

/** Convertit les lignes pas encore reprises d'un enfant (lecture tolérante, avant le contract). */
export async function ensureLegacyConverted(profileId: string) {
  const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::bigint AS n FROM "KidDayEntry" WHERE "profileId" = ${profileId} AND "values" IS NULL`;
  if (Number(n) === 0) return;
  await kidTx(async (tx) => {
    await lockProfile(tx, profileId);
    await convertInTx(tx, profileId);
  });
}

/**
 * Lecture seule pour l'export RGPD : aucune écriture en base (un export ne doit jamais
 * créer de rubrique ni convertir de ligne). Pour chaque enfant, les rubriques existantes
 * (masquées comprises) ; une ligne pas encore reprise (`values` nul) est lue depuis les
 * anciennes colonnes, avec les rubriques reprises si elles existent (libellé que la famille
 * a pu renommer), sinon avec les libellés d'origine de prisma/kid-legacy.js.
 * Supprimé avec les anciennes colonnes au contract.
 */
export async function loadReadableContext(profileIds: string[]) {
  const rows = await prisma.kidTracker.findMany({
    where: { profileId: { in: profileIds } },
    include: { options: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const rowsByProfile = new Map<string, TrackerRow[]>();
  for (const r of rows) rowsByProfile.set(r.profileId, [...(rowsByProfile.get(r.profileId) ?? []), r]);
  const trackers = (profileId: string) => (rowsByProfile.get(profileId) ?? []).map((r) => toDto(r, true));

  const readable = (
    profileId: string,
    entry: LegacyRow & { values: unknown }
  ): Record<string, string[] | number> => {
    const persisted = rowsByProfile.get(profileId) ?? [];
    const dtos = persisted.map((r) => toDto(r, true));
    if (entry.values !== null && entry.values !== undefined) return describeValues(entry.values, dtos);
    const index: LegacyIndex = new Map();
    const virtual: KidTrackerDto[] = [];
    for (const spec of LEGACY_SPECS) {
      const t = persisted.find((r) => r.legacyKey === spec.key);
      if (t) {
        index.set(spec.key, {
          trackerId: t.id,
          options: new Map(t.options.filter((o) => o.legacyValue !== null).map((o) => [o.legacyValue as string, o.id])),
        });
        continue;
      }
      const trackerId = `legacy:${spec.key}`;
      index.set(spec.key, { trackerId, options: new Map(spec.options.map(([v]) => [v, `${trackerId}:${v}`])) });
      virtual.push({
        id: trackerId,
        profileId,
        label: spec.label,
        icon: spec.icon,
        kind: spec.kind as KidTrackerKind,
        position: 0,
        active: true,
        needsRename: !!spec.needsRename,
        options: spec.options.map(([v, label, icon], i) => ({ id: `${trackerId}:${v}`, label, icon, position: i, active: true })),
      });
    }
    return describeValues(legacyToValues(entry, index).values, [...dtos, ...virtual]);
  };
  return { trackers, readable };
}

// ─── Validation de la configuration ───────────────────────────────────────────

/** Libellé nettoyé (espaces, caractères de contrôle) : 1 à 30 caractères, sinon KidError. */
export function cleanKidLabel(value: unknown, what = "libellé"): string {
  if (typeof value !== "string") throw new KidError(400, "label_invalid", `${what} requis`);
  const label = stripInvisible(value)
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
  const length = Array.from(label).length;
  if (length === 0) throw new KidError(400, "label_invalid", `${what} vide`);
  if (length > KID_LABEL_MAX) {
    throw new KidError(400, "label_too_long", `${what} trop long (${KID_LABEL_MAX} caractères au plus)`);
  }
  return label;
}

function cleanIcon(value: unknown): string {
  if (!isKidIconId(value)) {
    throw new KidError(400, "icon_invalid", "Image inconnue", [...KID_ICON_IDS]);
  }
  return value;
}

export interface TrackerInput {
  label: string;
  icon: string;
  kind: KidTrackerKind;
  options: Array<{ label: string; icon: string }>;
}

function assertUniqueLabels(labels: string[], what: string) {
  const seen = new Set<string>();
  for (const l of labels) {
    const k = normalizeKidKey(l);
    if (seen.has(k)) throw new KidError(409, "duplicate_label", `${what} « ${l} » existe déjà`);
    seen.add(k);
  }
}

/** Corps de création d'une rubrique → valeurs sûres. Lève KidError (400) sinon. */
export function validateTrackerInput(body: unknown): TrackerInput {
  const b = asRecord(body);
  const label = cleanKidLabel(b.label, "Libellé de la rubrique");
  const icon = cleanIcon(b.icon);
  if (typeof b.kind !== "string" || !KID_KINDS.includes(b.kind as KidTrackerKind)) {
    throw new KidError(400, "kind_invalid", "Type de rubrique inconnu", [...KID_KINDS]);
  }
  const kind = b.kind as KidTrackerKind;
  const rawOptions = b.options === undefined ? [] : b.options;
  if (!Array.isArray(rawOptions)) throw new KidError(400, "options_invalid", "options doit être une liste");
  if (kind === "count") {
    if (rawOptions.length > 0) throw new KidError(400, "options_invalid", "Un compteur n'a pas de choix");
    return { label, icon, kind, options: [] };
  }
  if (rawOptions.length === 0) throw new KidError(400, "options_required", "Au moins un choix est requis");
  if (rawOptions.length > Math.min(KID_MAX_ACTIVE_OPTIONS, MAX_OPTIONS_TOTAL)) {
    throw new KidError(400, "too_many_options", `${KID_MAX_ACTIVE_OPTIONS} choix au plus par rubrique`);
  }
  const options = rawOptions.map((o) => {
    const r = asRecord(o);
    return { label: cleanKidLabel(r.label, "Libellé du choix"), icon: cleanIcon(r.icon) };
  });
  assertUniqueLabels(options.map((o) => o.label), "Le choix");
  return { label, icon, kind, options };
}

// ─── Création, modification, ordre, suppression ───────────────────────────────

async function usedOptionIds(tx: Tx, profileId: string, trackerId: string): Promise<Set<string>> {
  const rows = await tx.$queryRaw<Array<{ v: unknown }>>`
    SELECT "values" -> ${trackerId}::text AS v FROM "KidDayEntry"
    WHERE "profileId" = ${profileId} AND jsonb_exists("values", ${trackerId}::text)`;
  const used = new Set<string>();
  for (const r of rows) if (Array.isArray(r.v)) for (const id of r.v) if (typeof id === "string") used.add(id);
  return used;
}

async function trackerHasEntries(tx: Tx, profileId: string, trackerId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::bigint AS n FROM "KidDayEntry"
    WHERE "profileId" = ${profileId} AND jsonb_exists("values", ${trackerId}::text)`;
  return Number(rows[0].n) > 0;
}

function assertTotalTrackerRoom(totalCount: number) {
  if (totalCount >= KID_MAX_TRACKERS_TOTAL) {
    throw new KidError(
      400,
      "too_many_trackers",
      `${KID_MAX_TRACKERS_TOTAL} rubriques au plus par enfant, masquées comprises : supprime une rubrique sans saisie`
    );
  }
}

function assertActiveTrackerRoom(activeCount: number) {
  if (activeCount >= KID_MAX_ACTIVE_TRACKERS) {
    throw new KidError(400, "too_many_trackers", `${KID_MAX_ACTIVE_TRACKERS} rubriques actives au plus par enfant`);
  }
}

function assertUniqueTrackerLabel(all: Array<{ id: string; label: string; active: boolean }>, label: string, selfId?: string) {
  const k = normalizeKidKey(label);
  if (all.some((t) => t.active && t.id !== selfId && normalizeKidKey(t.label) === k)) {
    throw new KidError(409, "duplicate_label", `Une rubrique « ${label} » existe déjà`);
  }
}

export async function createTracker(profileId: string, userId: string, input: TrackerInput) {
  return kidTx(async (tx) => {
    await lockProfile(tx, profileId);
    await convertInTx(tx, profileId);
    const all = await tx.kidTracker.findMany({ where: { profileId }, select: { id: true, label: true, active: true, position: true } });
    assertTotalTrackerRoom(all.length);
    assertActiveTrackerRoom(all.filter((t) => t.active).length);
    assertUniqueTrackerLabel(all, input.label);
    const created = await tx.kidTracker.create({
      data: {
        profileId,
        label: input.label,
        icon: input.icon,
        kind: input.kind,
        position: all.reduce((m, t) => Math.max(m, t.position), -1) + 1,
        createdById: userId,
        options: { create: input.options.map((o, i) => ({ label: o.label, icon: o.icon, position: i })) },
      },
      include: { options: true },
    });
    return toDto(created, true);
  });
}

interface OptionPatch {
  id?: string;
  label?: string;
  icon?: string;
  active?: boolean;
  delete?: boolean;
}

export interface TrackerPatch {
  label?: string;
  icon?: string;
  active?: boolean;
  needsRename?: false;
  options?: OptionPatch[];
}

/** Corps de modification → valeurs sûres (chaque champ est facultatif). */
export function validateTrackerPatch(body: unknown, kind?: KidTrackerKind): TrackerPatch {
  const b = asRecord(body);
  const patch: TrackerPatch = {};
  if (b.kind !== undefined && kind && b.kind !== kind) {
    throw new KidError(400, "kind_immutable", "Le type d'une rubrique ne change pas : crée une autre rubrique");
  }
  if (b.label !== undefined) patch.label = cleanKidLabel(b.label, "Libellé de la rubrique");
  if (b.icon !== undefined) patch.icon = cleanIcon(b.icon);
  if (b.active !== undefined) {
    if (typeof b.active !== "boolean") throw new KidError(400, "active_invalid", "active doit être vrai ou faux");
    patch.active = b.active;
  }
  if (b.needsRename !== undefined) {
    if (b.needsRename !== false) throw new KidError(400, "needs_rename_invalid", "needsRename ne peut être que false");
    patch.needsRename = false;
  }
  if (b.options !== undefined) {
    if (!Array.isArray(b.options)) throw new KidError(400, "options_invalid", "options doit être une liste");
    if (b.options.length > MAX_OPTIONS_TOTAL) throw new KidError(400, "too_many_options", "Trop de choix");
    patch.options = b.options.map((o) => {
      const r = asRecord(o);
      const item: OptionPatch = {};
      if (r.id !== undefined) {
        if (typeof r.id !== "string") throw new KidError(400, "option_invalid", "id de choix invalide");
        item.id = r.id;
      }
      if (r.label !== undefined) item.label = cleanKidLabel(r.label, "Libellé du choix");
      if (r.icon !== undefined) item.icon = cleanIcon(r.icon);
      if (r.active !== undefined) {
        if (typeof r.active !== "boolean") throw new KidError(400, "active_invalid", "active doit être vrai ou faux");
        item.active = r.active;
      }
      if (r.delete !== undefined) {
        if (r.delete !== true) throw new KidError(400, "option_invalid", "delete ne peut être que true");
        item.delete = true;
      }
      if (!item.id && (item.label === undefined || item.icon === undefined)) {
        throw new KidError(400, "option_invalid", "Un nouveau choix demande un libellé et une image");
      }
      return item;
    });
  }
  if (Object.keys(patch).length === 0) throw new KidError(400, "empty_patch", "Rien à modifier");
  return patch;
}

export async function updateTracker(trackerId: string, body: unknown) {
  const head = await prisma.kidTracker.findUnique({ where: { id: trackerId }, select: { profileId: true, kind: true } });
  if (!head) throw new KidError(404, "not_found", "Rubrique introuvable");
  const patch = validateTrackerPatch(body, head.kind as KidTrackerKind);
  const profileId = head.profileId;

  return kidTx(async (tx) => {
    await lockProfile(tx, profileId);
    await convertInTx(tx, profileId);
    const current = await tx.kidTracker.findUnique({ where: { id: trackerId }, include: { options: true } });
    if (!current) throw new KidError(404, "not_found", "Rubrique introuvable");
    const siblings = await tx.kidTracker.findMany({ where: { profileId }, select: { id: true, label: true, active: true } });

    const nextLabel = patch.label ?? current.label;
    const nextActive = patch.active ?? current.active;
    if (nextActive) {
      assertUniqueTrackerLabel(siblings, nextLabel, current.id);
      if (!current.active) assertActiveTrackerRoom(siblings.filter((t) => t.active).length);
    }

    const data: Prisma.KidTrackerUpdateInput = {};
    if (patch.label !== undefined) {
      data.label = patch.label;
      data.needsRename = false; // enregistrer un libellé, même identique, vaut renommage
    }
    if (patch.needsRename === false) data.needsRename = false;
    if (patch.icon !== undefined) data.icon = patch.icon;
    if (patch.active !== undefined) data.active = patch.active;

    if (patch.options) {
      if (current.kind === "count") throw new KidError(400, "options_invalid", "Un compteur n'a pas de choix");
      const byId = new Map(current.options.map((o) => [o.id, o]));
      const used = await usedOptionIds(tx, profileId, trackerId);
      const touched = new Set<string>();
      const ordered: string[] = [];
      for (const item of patch.options) {
        if (item.id) {
          const existing = byId.get(item.id);
          if (!existing) throw new KidError(400, "option_unknown", "Choix inconnu pour cette rubrique");
          if (touched.has(item.id)) throw new KidError(400, "option_invalid", "Choix cité deux fois");
          touched.add(item.id);
          if (item.delete) {
            // Avec des saisies : masqué, jamais supprimé.
            if (used.has(item.id)) await tx.kidTrackerOption.update({ where: { id: item.id }, data: { active: false } });
            else await tx.kidTrackerOption.delete({ where: { id: item.id } });
            if (!used.has(item.id)) byId.delete(item.id);
            continue;
          }
          await tx.kidTrackerOption.update({
            where: { id: item.id },
            data: {
              ...(item.label !== undefined ? { label: item.label } : {}),
              ...(item.icon !== undefined ? { icon: item.icon } : {}),
              ...(item.active !== undefined ? { active: item.active } : {}),
            },
          });
          ordered.push(item.id);
        } else {
          if (item.delete) throw new KidError(400, "option_invalid", "delete demande l'id du choix");
          const created = await tx.kidTrackerOption.create({
            data: { trackerId, label: item.label!, icon: item.icon!, active: item.active ?? true, position: 0 },
          });
          ordered.push(created.id);
        }
      }
      // Ordre = ordre du tableau ; les choix non cités restent, à la suite et dans leur ordre.
      const rest = current.options
        .filter((o) => byId.has(o.id) && !ordered.includes(o.id))
        .sort((a, b) => a.position - b.position)
        .map((o) => o.id);
      const finalOrder = [...ordered, ...rest];
      for (let i = 0; i < finalOrder.length; i++) {
        await tx.kidTrackerOption.update({ where: { id: finalOrder[i] }, data: { position: i } });
      }
    }

    if (Object.keys(data).length > 0) await tx.kidTracker.update({ where: { id: trackerId }, data });

    const fresh = await tx.kidTracker.findUniqueOrThrow({ where: { id: trackerId }, include: { options: true } });
    if (fresh.kind !== "count") {
      const actives = fresh.options.filter((o) => o.active);
      if (fresh.active && actives.length === 0) {
        throw new KidError(400, "options_required", "Une rubrique active garde au moins un choix actif");
      }
      if (actives.length > KID_MAX_ACTIVE_OPTIONS) {
        throw new KidError(400, "too_many_options", `${KID_MAX_ACTIVE_OPTIONS} choix actifs au plus par rubrique`);
      }
      if (fresh.options.length > MAX_OPTIONS_TOTAL) throw new KidError(400, "too_many_options", "Trop de choix");
      assertUniqueLabels(actives.map((o) => o.label), "Le choix");
    }
    return toDto(fresh, true);
  });
}

/** Supprime une rubrique sans aucune saisie ; avec des saisies : 409, il faut la masquer. */
export async function deleteTracker(trackerId: string) {
  const head = await prisma.kidTracker.findUnique({ where: { id: trackerId }, select: { profileId: true } });
  if (!head) throw new KidError(404, "not_found", "Rubrique introuvable");
  await kidTx(async (tx) => {
    await lockProfile(tx, head.profileId);
    await convertInTx(tx, head.profileId);
    if (await trackerHasEntries(tx, head.profileId, trackerId)) {
      throw new KidError(409, "has_entries", "Cette rubrique a des saisies : masque-la (active: false) au lieu de la supprimer");
    }
    await tx.kidTracker.deleteMany({ where: { id: trackerId } });
  });
}

/** Nouvel ordre : les rubriques citées d'abord, dans cet ordre ; les autres à la suite. */
export async function orderTrackers(profileId: string, ids: unknown) {
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    throw new KidError(400, "ids_invalid", "ids doit être une liste d'identifiants de rubriques");
  }
  const wanted = ids as string[];
  if (new Set(wanted).size !== wanted.length) throw new KidError(400, "ids_invalid", "Rubrique citée deux fois");
  return kidTx(async (tx) => {
    await lockProfile(tx, profileId);
    await convertInTx(tx, profileId);
    const all = await tx.kidTracker.findMany({
      where: { profileId },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const known = new Set(all.map((t) => t.id));
    if (wanted.some((i) => !known.has(i))) throw new KidError(400, "ids_invalid", "Rubrique inconnue pour cet enfant");
    const finalOrder = [...wanted, ...all.map((t) => t.id).filter((i) => !wanted.includes(i))];
    for (let i = 0; i < finalOrder.length; i++) {
      await tx.kidTracker.update({ where: { id: finalOrder[i] }, data: { position: i } });
    }
    return loadTrackers(profileId, { includeInactive: true }, tx);
  });
}

// ─── Saisie d'un jour ─────────────────────────────────────────────────────────

type DayPatch = Record<string, string[] | number | null>;

function listOrKeep(labels: string[]) {
  return labels.length > 0 ? labels : undefined;
}

/**
 * Corps `values` de la saisie d'un jour → { idRubrique: idsDesChoix | nombre | null }.
 * Une rubrique se désigne par son id ou son libellé (sans casse ni accents), un choix
 * de même. Une valeur inconnue est refusée avec la liste des valeurs acceptées ; une
 * rubrique masquée est refusée. `null` (ou une liste vide) efface la rubrique du jour.
 */
export function validateDayPatch(trackers: KidTrackerDto[], raw: unknown): DayPatch {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new KidError(400, "values_invalid", "values doit être un objet { rubrique: valeur }");
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) throw new KidError(400, "values_invalid", "values est vide");
  if (entries.length > 50) throw new KidError(400, "values_invalid", "Trop de rubriques");

  const activeLabels = trackers.filter((t) => t.active).map((t) => t.label);
  const out: DayPatch = {};
  for (const [key, value] of entries) {
    const byId = trackers.find((t) => t.id === key);
    const byLabel = byId ? undefined : trackers.find((t) => normalizeKidKey(t.label) === normalizeKidKey(key) && t.active);
    const tracker = byId ?? byLabel ?? trackers.find((t) => normalizeKidKey(t.label) === normalizeKidKey(key));
    if (!tracker) {
      throw new KidError(400, "tracker_unknown", `Rubrique inconnue « ${key.slice(0, 60)} »`, listOrKeep(activeLabels));
    }
    if (!tracker.active) {
      throw new KidError(400, "tracker_hidden", `La rubrique « ${tracker.label} » est masquée : réactive-la avant d'y saisir`);
    }
    if (tracker.id in out) throw new KidError(400, "values_invalid", `Rubrique « ${tracker.label} » citée deux fois`);

    if (value === null) {
      out[tracker.id] = null;
      continue;
    }
    if (tracker.kind === "count") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > KID_COUNT_MAX) {
        throw new KidError(400, "value_invalid", `« ${tracker.label} » attend un nombre entier de 0 à ${KID_COUNT_MAX}`);
      }
      out[tracker.id] = value;
      continue;
    }
    const list = Array.isArray(value) ? value : [value];
    if (list.some((v) => typeof v !== "string")) {
      throw new KidError(400, "value_invalid", `« ${tracker.label} » attend des choix (texte)`);
    }
    const activeOptions = tracker.options.filter((o) => o.active);
    const ids: string[] = [];
    for (const v of list as string[]) {
      const opt =
        activeOptions.find((o) => o.id === v) ??
        activeOptions.find((o) => normalizeKidKey(o.label) === normalizeKidKey(v));
      if (!opt) {
        throw new KidError(
          400,
          "value_unknown",
          `Valeur inconnue « ${v.slice(0, 60)} » pour « ${tracker.label} »`,
          activeOptions.map((o) => o.label)
        );
      }
      if (!ids.includes(opt.id)) ids.push(opt.id);
    }
    if (tracker.kind === "single" && ids.length > 1) {
      throw new KidError(400, "value_invalid", `« ${tracker.label} » n'accepte qu'un seul choix`);
    }
    out[tracker.id] = ids.length > 0 ? ids : null;
  }
  return out;
}

/** Date AAAA-MM-JJ réelle, entre 2000 et 2100 ; sinon 400. */
export function requireKidDate(value: unknown, name = "date"): string {
  if (!isRealDate(value)) throw new KidError(400, "date_invalid", `${name} attendue au format AAAA-MM-JJ`);
  if (value < "2000-01-01" || value > "2100-12-31") throw new KidError(400, "date_invalid", `${name} hors limites`);
  return value;
}

/**
 * Écrit une journée : fusionne le corps dans les saisies existantes (les rubriques non
 * citées ne bougent pas), sous verrou de ligne. L'auteur d'une ligne existante ne change
 * jamais (ADR 0001) ; la première saisie du jour crée la ligne au nom de l'utilisateur.
 */
export async function writeDay(profileId: string, userId: string, date: string, rawValues: unknown) {
  return kidTx(async (tx) => {
    await lockProfile(tx, profileId);
    await convertInTx(tx, profileId);

    const trackers = await loadTrackers(profileId, { includeInactive: true }, tx);
    const patch = validateDayPatch(trackers, rawValues);

    // Crée la ligne du jour si besoin (sans erreur si une autre l'a créée), puis la verrouille.
    await tx.kidDayEntry.createMany({ data: [{ userId, profileId, date, values: {} }], skipDuplicates: true });
    const locked = await tx.$queryRaw<Array<{ id: string; values: unknown }>>`
      SELECT id, "values" FROM "KidDayEntry" WHERE "profileId" = ${profileId} AND "date" = ${date} FOR UPDATE`;
    const row = locked[0];
    const merged = { ...asRecord(row.values) } as Record<string, unknown>;
    for (const [trackerId, v] of Object.entries(patch)) {
      if (v === null) delete merged[trackerId];
      else merged[trackerId] = v;
    }
    const updated = await tx.kidDayEntry.update({
      where: { id: row.id },
      data: { values: merged as Prisma.InputJsonObject },
      select: { date: true, values: true, updatedAt: true },
    });
    return {
      date: updated.date,
      values: visibleValues(updated.values, trackers.filter((t) => t.active)),
      updatedAt: updated.updatedAt,
    };
  });
}

// ─── Lecture d'une période ────────────────────────────────────────────────────

export function requireKidRange(from: unknown, to: unknown): { from: string; to: string } {
  const f = requireKidDate(from, "from");
  const t = requireKidDate(to, "to");
  if (f > t) throw new KidError(400, "range_invalid", "from doit précéder to");
  if (daysBetween(f, t) > KID_MAX_WEEK_DAYS) {
    throw new KidError(400, "range_too_long", `${KID_MAX_WEEK_DAYS} jours au plus par lecture`);
  }
  return { from: f, to: t };
}

export async function readWeek(profileId: string, range: { from: string; to: string }) {
  await ensureLegacyConverted(profileId);
  // Rubriques actives avec TOUS leurs choix : une saisie ancienne sur un choix masqué reste lisible.
  const trackers = await loadTrackers(profileId, { includeInactive: false, includeInactiveOptions: true });
  const entries = await prisma.kidDayEntry.findMany({
    where: { profileId, date: { gte: range.from, lte: range.to } },
    select: { date: true, values: true },
  });
  const byDate = new Map(entries.map((e) => [e.date, e.values]));
  const days: KidDayDto[] = eachDate(range.from, range.to).map((date) => ({
    date,
    values: visibleValues(byDate.get(date), trackers),
  }));
  const summary = summarizeWeek(trackers, days, { ...range, today: todayInParis() });
  return { trackers, days, summary };
}

export async function listTrackers(profileId: string, all: boolean) {
  await ensureLegacyConverted(profileId);
  return loadTrackers(profileId, { includeInactive: all });
}
