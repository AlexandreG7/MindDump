import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { expandRecurrences } from "./calendarEvents";
import { fetchICSEvents } from "./ics";
import { assigneesInclude, syncGroupProfiles, withAssigneeIds } from "./profiles";

/**
 * Écran mural : une tablette affiche le tableau d'un groupe sans session, par
 * un lien secret /wall/<jeton>. Seule l'empreinte du jeton est en base ; il
 * n'est montré qu'une fois, à la création. Supprimer l'écran le révoque.
 *
 * Périmètre volontairement étroit : les éléments du GROUPE (jamais les
 * éléments personnels de ses membres), en lecture, plus deux gestes : cocher
 * une tâche et cocher un article de courses.
 */

export function generateWallToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashWallToken(token) };
}

export function hashWallToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const SEEN_THROTTLE_MS = 5 * 60 * 1000;

/** Écran correspondant au jeton (null si inconnu ou révoqué) ; note sa dernière visite. */
export async function findWallDevice(token: string) {
  if (!token || token.length > 100) return null;
  const device = await prisma.wallDevice.findUnique({
    where: { tokenHash: hashWallToken(token) },
    select: { id: true, name: true, groupId: true, lastSeenAt: true, group: { select: { name: true, ownerId: true } } },
  });
  if (!device) return null;
  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > SEEN_THROTTLE_MS) {
    await prisma.wallDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return device;
}

type WallDeviceInfo = NonNullable<Awaited<ReturnType<typeof findWallDevice>>>;

const MAX_RANGE_MS = 15 * 86400000;

/** Intervalle affiché (calculé par l'écran dans son fuseau), 15 jours au plus ; sinon 7 jours. */
export function parseWallRange(fromParam: string | null, toParam: string | null): { from: Date; to: Date } {
  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;
  if (from && to && !isNaN(from.getTime()) && !isNaN(to.getTime()) && to > from && to.getTime() - from.getTime() <= MAX_RANGE_MS) {
    return { from, to };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { from: start, to: new Date(start.getTime() + 7 * 86400000 - 1) };
}

async function weatherFor(ownerId: string) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { weatherLat: true, weatherLon: true, weatherCity: true },
  });
  const lat = owner?.weatherLat ?? 48.8566;
  const lon = owner?.weatherLon ?? 2.3522;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  try {
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      city: (owner?.weatherCity ?? null) as string | null,
      temperature: (data.current?.temperature_2m ?? null) as number | null,
      code: (data.current?.weather_code ?? null) as number | null,
      daily: ((data.daily?.time ?? []) as string[]).map(
        (day, i): { day: string; code: number; max: number; min: number } => ({
          day,
          code: data.daily.weather_code[i],
          max: data.daily.temperature_2m_max[i],
          min: data.daily.temperature_2m_min[i],
        })
      ),
    };
  } catch {
    return null;
  }
}

/** Tout ce qu'affiche l'écran, en une requête. */
export async function buildWallSnapshot(device: WallDeviceInfo, from: Date, to: Date) {
  const groupId = device.groupId;

  const [profiles, eventRows, subscriptions, todoRows, lists, meals, weather] = await Promise.all([
    syncGroupProfiles(groupId),
    prisma.calendarEvent.findMany({
      where: {
        groupId,
        date: { lte: to },
        OR: [
          { recurrence: { not: null, notIn: ["none", ""] } },
          { date: { gte: from } },
          { endDate: { gte: from } },
        ],
      },
      include: assigneesInclude,
      orderBy: { date: "asc" },
    }),
    prisma.calendarSubscription.findMany({
      where: { groupId, enabled: true },
      select: { id: true, name: true, url: true, color: true },
    }),
    prisma.todo.findMany({
      where: { groupId, completed: false },
      include: assigneesInclude,
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { position: "asc" }],
      take: 30,
    }),
    prisma.shoppingList.findMany({
      where: { groupId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        items: { where: { checked: false }, select: { id: true, name: true, quantity: true }, take: 40 },
      },
      take: 5,
    }),
    prisma.recipe.findMany({
      where: { groupId, planned: true },
      select: { id: true, title: true, image: true },
      orderBy: { updatedAt: "desc" },
      take: 7,
    }),
    weatherFor(device.group.ownerId),
  ]);

  const external = (
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const events = await fetchICSEvents(sub.url, from, to);
          return events.map((e) => ({
            id: `sub_${sub.id}_${e.uid}`,
            title: e.title,
            date: e.date.toISOString(),
            endDate: e.endDate?.toISOString() ?? null,
            allDay: e.allDay,
            color: sub.color,
            assigneeIds: [] as string[],
            source: sub.name,
          }));
        } catch {
          return [];
        }
      })
    )
  ).flat();

  const events = expandRecurrences(eventRows.map(withAssigneeIds), from, to).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    allDay: e.allDay,
    color: e.color,
    assigneeIds: e.assigneeIds,
    source: null as string | null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    device: { name: device.name },
    group: { name: device.group.name },
    profiles: profiles.map((p) => ({ id: p.id, name: p.name, color: p.color, emoji: p.emoji, kind: p.kind })),
    events: [...events, ...external].sort((a, b) => a.date.localeCompare(b.date)),
    todos: todoRows.map(withAssigneeIds).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      assigneeIds: t.assigneeIds,
    })),
    lists: lists.filter((l) => l.items.length > 0),
    meals,
    weather,
  };
}

export type WallSnapshot = Awaited<ReturnType<typeof buildWallSnapshot>>;
