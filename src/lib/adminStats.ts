import { readdir, stat } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { UPLOAD_DIR } from "./uploads";

/**
 * Statistiques du dashboard admin. Tout est agrégé en SQL (count, groupBy,
 * generate_series, pg_total_relation_size) : aucune table n'est chargée en
 * mémoire. Les agrégats globaux sont mis en cache 60 s ; la vérification du
 * rôle admin, elle, n'est jamais en cache (voir src/lib/admin.ts).
 */

const TIME_ZONE = "Europe/Paris";
const SERIES_DAYS = 30;
const CACHE_SECONDS = 60;

export interface DayPoint {
  day: string; // YYYY-MM-DD, heure de Paris
  count: number;
}

// ─── Vue d'ensemble ────────────────────────────────────────────

async function dailySeries(table: "LoginEvent" | "Recipe"): Promise<DayPoint[]> {
  // Nom de table issu d'une liste fermée (pas d'entrée utilisateur).
  const tableSql = Prisma.raw(`"${table}"`);
  const rows = await prisma.$queryRaw<{ day: string; count: number }[]>`
    WITH days AS (
      SELECT generate_series(
        (now() AT TIME ZONE ${TIME_ZONE})::date - ${SERIES_DAYS - 1}::int,
        (now() AT TIME ZONE ${TIME_ZONE})::date,
        interval '1 day'
      )::date AS day
    ),
    counts AS (
      SELECT ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE})::date AS day,
             count(*)::int AS n
      FROM ${tableSql}
      WHERE "createdAt" >= now() - interval '32 days'
      GROUP BY 1
    )
    SELECT to_char(days.day, 'YYYY-MM-DD') AS day, COALESCE(counts.n, 0)::int AS count
    FROM days LEFT JOIN counts ON counts.day = days.day
    ORDER BY days.day
  `;
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

async function computeOverview() {
  const [
    users,
    groups,
    recipes,
    todos,
    shoppingLists,
    usersWithApiKey,
    apiKeys,
    logins,
    recipesPerDay,
    firstLogin,
    activeUsers30d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.recipe.count(),
    prisma.todo.count(),
    prisma.shoppingList.count(),
    prisma.user.count({ where: { apiKeys: { some: {} } } }),
    prisma.apiKey.count(),
    dailySeries("LoginEvent"),
    dailySeries("Recipe"),
    prisma.loginEvent.aggregate({ _min: { createdAt: true } }),
    prisma.user.count({
      where: { lastLoginAt: { gte: new Date(Date.now() - SERIES_DAYS * 86_400_000) } },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    totals: { users, groups, recipes, todos, shoppingLists },
    ai: { usersWithApiKey, apiKeys, ratio: users > 0 ? usersWithApiKey / users : 0 },
    activeUsers30d,
    logins,
    recipesPerDay,
    loginHistoryStart: firstLogin._min.createdAt?.toISOString() ?? null,
  };
}

export type AdminOverview = Awaited<ReturnType<typeof computeOverview>>;

export const getAdminOverview = unstable_cache(computeOverview, ["admin-overview"], {
  revalidate: CACHE_SECONDS,
});

// ─── Stockage ──────────────────────────────────────────────────

async function scanDir(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { files, bytes }; // dossier absent
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await scanDir(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += (await stat(full)).size;
    }
  }
  return { files, bytes };
}

async function computeStorage() {
  const legacyDir = path.join(process.cwd(), "public", "uploads");
  const uploadDirs = Array.from(new Set([UPLOAD_DIR, legacyDir]));

  const [tables, database, recipeCount, todoCount, listCount, recipes30d, recipesWithUpload, scans] =
    await Promise.all([
      prisma.$queryRaw<{ name: string; bytes: number; rows: number }[]>`
        SELECT c.relname AS name,
               pg_total_relation_size(c.oid)::float8 AS bytes,
               GREATEST(c.reltuples, 0)::float8 AS rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind = 'r'
        ORDER BY bytes DESC
      `,
      prisma.$queryRaw<{ bytes: number }[]>`
        SELECT pg_database_size(current_database())::float8 AS bytes
      `,
      prisma.recipe.count(),
      prisma.todo.count(),
      prisma.shoppingList.count(),
      prisma.recipe.count({
        where: { createdAt: { gte: new Date(Date.now() - SERIES_DAYS * 86_400_000) } },
      }),
      prisma.recipe.count({ where: { image: { startsWith: "/uploads/" } } }),
      Promise.all(uploadDirs.map((dir) => scanDir(dir))),
    ]);

  const sizeOf = (name: string) => Number(tables.find((t) => t.name === name)?.bytes ?? 0);
  const perRow = (bytes: number, count: number) => (count > 0 ? bytes / count : null);

  const recipeBytes = sizeOf("Recipe") + sizeOf("RecipeIngredient");
  const todoBytes = sizeOf("Todo");
  const listBytes = sizeOf("ShoppingList") + sizeOf("ShoppingItem");

  const uploads = uploadDirs.map((dir, i) => ({
    dir,
    files: scans[i].files,
    bytes: scans[i].bytes,
  }));
  const uploadFiles = uploads.reduce((s, u) => s + u.files, 0);
  const uploadBytes = uploads.reduce((s, u) => s + u.bytes, 0);
  const avgFileBytes = uploadFiles > 0 ? uploadBytes / uploadFiles : 0;

  // Projection linéaire au rythme des 30 derniers jours.
  const recipesPerDay = recipes30d / SERIES_DAYS;
  const avgRecipeBytes = perRow(recipeBytes, recipeCount) ?? 0;
  const photoShare = recipeCount > 0 ? recipesWithUpload / recipeCount : 0;
  const dbGrowthPerMonth = recipesPerDay * 30 * avgRecipeBytes;
  const uploadGrowthPerMonth = recipesPerDay * 30 * photoShare * avgFileBytes;

  return {
    generatedAt: new Date().toISOString(),
    database: {
      totalBytes: Number(database[0]?.bytes ?? 0),
      tables: tables.map((t) => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })),
      averages: {
        recipe: perRow(recipeBytes, recipeCount),
        todo: perRow(todoBytes, todoCount),
        shoppingList: perRow(listBytes, listCount),
      },
    },
    uploads: { dirs: uploads, files: uploadFiles, bytes: uploadBytes, avgFileBytes },
    projection: {
      recipesPerDay,
      photoShare,
      dbGrowthPerMonth,
      uploadGrowthPerMonth,
    },
  };
}

export type AdminStorage = Awaited<ReturnType<typeof computeStorage>>;

export const getAdminStorage = unstable_cache(computeStorage, ["admin-storage"], {
  revalidate: CACHE_SECONDS,
});

// ─── Utilisateurs ──────────────────────────────────────────────

export const USERS_PAGE_SIZE = 50;

export const USER_SORT_KEYS = [
  "email",
  "createdAt",
  "lastLoginAt",
  "recipes",
  "todos",
  "lists",
  "groups",
  "apiKey",
] as const;
export type UserSortKey = (typeof USER_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

function userOrderBy(sort: UserSortKey, dir: SortDir): Prisma.UserOrderByWithRelationInput {
  switch (sort) {
    case "email":
      return { email: dir };
    case "lastLoginAt":
      return { lastLoginAt: { sort: dir, nulls: "last" } };
    case "recipes":
      return { recipes: { _count: dir } };
    case "todos":
      return { todos: { _count: dir } };
    case "lists":
      return { shoppingLists: { _count: dir } };
    case "groups":
      return { groupMemberships: { _count: dir } };
    case "apiKey":
      return { apiKeys: { _count: dir } };
    default:
      return { createdAt: dir };
  }
}

export function parseUsersQuery(params: URLSearchParams | Record<string, string | undefined>) {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) ?? undefined : params[k];
  const sortParam = get("sort");
  const sort: UserSortKey = (USER_SORT_KEYS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as UserSortKey)
    : "createdAt";
  const dir: SortDir = get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Math.floor(Number(get("page")) || 1));
  return { sort, dir, page };
}

// Une seule requête (les _count sont des sous-requêtes SQL) + un count.
// La valeur des clés API n'est jamais sélectionnée : seulement leur nombre.
export async function getAdminUsers({ sort, dir, page }: ReturnType<typeof parseUsersQuery>) {
  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: [userOrderBy(sort, dir), { id: "asc" }],
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            recipes: true,
            todos: true,
            shoppingLists: true,
            groupMemberships: true,
            apiKeys: true,
          },
        },
      },
    }),
  ]);

  return {
    sort,
    dir,
    page,
    pageSize: USERS_PAGE_SIZE,
    total,
    pages: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: u.role === "admin",
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      recipes: u._count.recipes,
      todos: u._count.todos,
      lists: u._count.shoppingLists,
      groups: u._count.groupMemberships,
      hasApiKey: u._count.apiKeys > 0,
    })),
  };
}

export type AdminUsersPage = Awaited<ReturnType<typeof getAdminUsers>>;
