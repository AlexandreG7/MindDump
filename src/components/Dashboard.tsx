"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDays, endOfDay, format, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowRight,
  Check,
  CalendarDays,
  ChefHat,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LayoutDashboard,
  Plus,
  RotateCcw,
  ShoppingCart,
  Snowflake,
  Sun,
  UtensilsCrossed,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { cn } from "@/lib/utils";
import { useFeaturesContext } from "@/components/FeaturesContext";
import { useGroupContext } from "@/components/GroupContext";
import { useFamilyProfiles, AssigneeAvatars } from "@/components/profiles/Assignees";
import { occursOn, sortEvents } from "@/components/calendar/utils";
import type { CalendarEvent } from "@/components/calendar/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedback } from "@/components/ui/feedback";
import { InstallPrompt } from "./InstallPrompt";
import { ModuleGrid } from "./dashboard/ModuleGrid";
import { DEFAULT_LAYOUT, normalizeLayout, type ModuleId, type ModuleSlot } from "@/lib/dashboardLayout";

const WMO_LABELS: Record<number, { label: string; icon: typeof Sun }> = {
  0: { label: "Dégagé", icon: Sun },
  1: { label: "Peu nuageux", icon: CloudSun },
  2: { label: "Partiellement nuageux", icon: CloudSun },
  3: { label: "Couvert", icon: Cloud },
  45: { label: "Brouillard", icon: CloudFog },
  48: { label: "Brouillard givrant", icon: CloudFog },
  51: { label: "Bruine légère", icon: CloudDrizzle },
  53: { label: "Bruine", icon: CloudDrizzle },
  55: { label: "Bruine forte", icon: CloudDrizzle },
  56: { label: "Bruine verglaçante", icon: CloudDrizzle },
  57: { label: "Bruine verglaçante forte", icon: CloudDrizzle },
  61: { label: "Pluie légère", icon: CloudRain },
  63: { label: "Pluie", icon: CloudRain },
  65: { label: "Pluie forte", icon: CloudRain },
  66: { label: "Pluie verglaçante", icon: CloudRain },
  67: { label: "Pluie verglaçante forte", icon: CloudRain },
  71: { label: "Neige légère", icon: CloudSnow },
  73: { label: "Neige", icon: CloudSnow },
  75: { label: "Neige forte", icon: CloudSnow },
  77: { label: "Grains de neige", icon: Snowflake },
  80: { label: "Averses légères", icon: CloudRain },
  81: { label: "Averses", icon: CloudRain },
  82: { label: "Averses violentes", icon: CloudRain },
  85: { label: "Averses de neige", icon: CloudSnow },
  86: { label: "Averses de neige fortes", icon: CloudSnow },
  95: { label: "Orage", icon: CloudLightning },
  96: { label: "Orage, grêle légère", icon: CloudLightning },
  99: { label: "Orage, grêle forte", icon: CloudLightning },
};

function getWeatherInfo(code: number) {
  return WMO_LABELS[code] ?? { label: "Inconnu", icon: Cloud };
}

interface Todo {
  id: string;
  title: string;
  priority: "URGENT" | "PLANNED";
  completed: boolean;
  dueDate: string | null;
  assigneeIds?: string[];
}

interface ShoppingList {
  id: string;
  name: string;
  type: string;
  items: { id: string; checked: boolean }[];
}

interface Meal {
  id: string;
  slot: "lunch" | "dinner";
  note: string | null;
  recipe: { id: string; title: string } | null;
}

interface WeatherData {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
  city: string | null;
}

/** Une ligne de la journée : un rendez-vous ou une tâche, rangés sur un même fil. */
type DayEntry =
  | { kind: "event"; key: string; rank: number; label: string; event: CalendarEvent }
  | { kind: "todo"; key: string; rank: number; label: string; late: boolean; todo: Todo };

// Rang de tri : en retard, journée entière, heures de la journée, puis « à faire » sans date.
const RANK_LATE = -2;
const RANK_ALL_DAY = -1;
const RANK_ANYTIME = 24 * 60 + 1;

function minutesOf(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function withGroup(url: string, groupId: string | null) {
  if (!groupId) return url;
  return `${url}${url.includes("?") ? "&" : "?"}groupId=${encodeURIComponent(groupId)}`;
}

async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function Dashboard() {
  const { session, status, isReady } = useAuth();
  const { flags, loading: flagsLoading } = useFeaturesContext();
  const { currentGroupId, currentGroup } = useGroupContext();
  const profiles = useFamilyProfiles(currentGroupId);
  const { toast } = useFeedback();

  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [quickAdd, setQuickAdd] = useState("");
  const [adding, setAdding] = useState(false);
  const [layout, setLayout] = useState<ModuleSlot[]>(DEFAULT_LAYOUT);
  const [customLayout, setCustomLayout] = useState(false);
  const [editing, setEditing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  const fetchTodos = useCallback(() => {
    if (!flags.todos) return setTodos([]);
    getJson<Todo[]>(withGroup("/api/todos", currentGroupId), []).then(setTodos);
  }, [flags.todos, currentGroupId]);

  useEffect(() => {
    if (!isReady || flagsLoading) return;
    fetchTodos();

    if (flags.calendar) {
      // Aujourd'hui et les 7 jours suivants, occurrences récurrentes comprises.
      const params = new URLSearchParams({
        from: today.toISOString(),
        to: endOfDay(addDays(today, 7)).toISOString(),
      });
      getJson<CalendarEvent[]>(withGroup(`/api/calendar?${params}`, currentGroupId), []).then(setEvents);
    } else {
      setEvents([]);
    }
    if (flags.lists) getJson<ShoppingList[]>(withGroup("/api/lists", currentGroupId), []).then(setLists);
    if (flags.recipes) {
      const day = format(today, "yyyy-MM-dd");
      getJson<Meal[]>(withGroup(`/api/meals?from=${day}&to=${day}`, currentGroupId), []).then(setMeals);
    }
  }, [isReady, flagsLoading, flags.calendar, flags.lists, flags.recipes, currentGroupId, today, fetchTodos]);

  useEffect(() => {
    if (!isReady) return;
    const fetchWeather = (lat?: number, lon?: number) => {
      const params = new URLSearchParams();
      if (lat != null && lon != null) {
        params.set("lat", lat.toString());
        params.set("lon", lon.toString());
      }
      getJson<WeatherData | null>(`/api/weather?${params}`, null).then((d) => d && setWeather(d));
    };
    getJson<{ weatherLat?: number; weatherLon?: number } | null>("/api/users/me", null).then((me) => {
      if (me?.weatherLat != null && me?.weatherLon != null) {
        fetchWeather(me.weatherLat, me.weatherLon);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
          () => fetchWeather(),
          { timeout: 3000 }
        );
      } else {
        fetchWeather();
      }
    });
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;
    getJson<{ layout: unknown; custom: boolean } | null>("/api/users/me/dashboard", null).then((d) => {
      if (!d) return;
      setLayout(normalizeLayout(d.layout));
      setCustomLayout(d.custom);
    });
  }, [isReady]);

  // Échap quitte le mode édition.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEditing(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const saveLayout = useCallback(
    (body: { layout: ModuleSlot[] | null }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const res = await fetch("/api/users/me/dashboard", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).catch(() => null);
        if (!res?.ok) toast("La disposition n'a pas pu être enregistrée.", "error");
      }, 400);
    },
    [toast]
  );

  const changeLayout = (next: ModuleSlot[]) => {
    setLayout(next);
    setCustomLayout(true);
    saveLayout({ layout: next });
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    setCustomLayout(false);
    saveLayout({ layout: null });
  };

  const dayEntries = useMemo<DayEntry[]>(() => {
    const entries: DayEntry[] = [];
    const endToday = endOfDay(today);

    for (const event of sortEvents((events ?? []).filter((e) => occursOn(e, today)))) {
      const start = new Date(event.date);
      const allDay = event.allDay || isBefore(start, today);
      entries.push({
        kind: "event",
        key: `e-${event.id}-${event.date}`,
        rank: allDay ? RANK_ALL_DAY : minutesOf(start),
        label: allDay ? "Journée" : format(start, "HH:mm"),
        event,
      });
    }

    for (const todo of todos ?? []) {
      if (todo.completed) continue;
      const due = todo.dueDate ? new Date(todo.dueDate) : null;
      if (due && isBefore(due, today)) {
        entries.push({ kind: "todo", key: `t-${todo.id}`, rank: RANK_LATE, label: "En retard", late: true, todo });
      } else if (due && !isBefore(endToday, due)) {
        const timed = minutesOf(due) !== 0;
        entries.push({
          kind: "todo",
          key: `t-${todo.id}`,
          rank: timed ? minutesOf(due) : RANK_ANYTIME,
          label: timed ? format(due, "HH:mm") : "Aujourd'hui",
          late: false,
          todo,
        });
      } else if (!due && todo.priority === "URGENT") {
        entries.push({ kind: "todo", key: `t-${todo.id}`, rank: RANK_ANYTIME, label: "À faire", late: false, todo });
      }
    }

    return entries.sort((a, b) => a.rank - b.rank);
  }, [events, todos, today]);

  const upcoming = useMemo(() => {
    const tomorrow = addDays(today, 1);
    return sortEvents((events ?? []).filter((e) => !isBefore(new Date(e.date), tomorrow))).slice(0, 4);
  }, [events, today]);

  const activeLists = lists
    .map((l) => ({ ...l, remaining: l.items.filter((i) => !i.checked).length }))
    .filter((l) => l.remaining > 0);

  const completeTodo = async (todo: Todo) => {
    setDone((d) => new Set(d).add(todo.id));
    const patch = (completed: boolean) =>
      fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      }).catch(() => null);

    const res = await patch(true);
    if (!res?.ok) {
      setDone((d) => {
        const next = new Set(d);
        next.delete(todo.id);
        return next;
      });
      toast("La tâche n'a pas pu être cochée.", "error");
      return;
    }
    toast(`« ${todo.title} » : fait`, "success", {
      label: "Annuler",
      onClick: async () => {
        await patch(false);
        setDone((d) => {
          const next = new Set(d);
          next.delete(todo.id);
          return next;
        });
        fetchTodos();
      },
    });
    // Recharge pour faire apparaître l'occurrence suivante d'une tâche récurrente.
    setTimeout(fetchTodos, 600);
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickAdd.trim();
    if (!title || adding) return;
    setAdding(true);
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority: "URGENT", groupId: currentGroupId }),
    }).catch(() => null);
    setAdding(false);
    if (!res?.ok) {
      toast("La tâche n'a pas pu être ajoutée.", "error");
      return;
    }
    setQuickAdd("");
    fetchTodos();
  };

  if (status === "loading" || flagsLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Chargement de l'accueil">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!session && !isReady) return null;

  const firstName = session?.user?.name?.split(" ")[0];
  const dateLabel = format(today, "EEEE d MMMM", { locale: fr });
  const WeatherIcon = weather ? getWeatherInfo(weather.current.weather_code).icon : null;
  const dayLoading = (flags.todos && todos === null) || (flags.calendar && events === null);
  const visibleEntries = dayEntries.filter((e) => e.kind === "event" || !done.has(e.todo.id));
  const showDay = flags.todos || flags.calendar;
  const available = new Set<ModuleId>([
    ...(showDay ? (["today"] as const) : []),
    ...(flags.recipes ? (["meals"] as const) : []),
    ...(flags.lists ? (["lists"] as const) : []),
    ...(flags.calendar ? (["week"] as const) : []),
    "weather",
  ]);

  if (!showDay && !flags.lists && !flags.recipes) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">Toutes les fonctionnalités sont désactivées.</p>
        <Link href="/profile" className="text-sm text-foreground underline underline-offset-2 mt-1 inline-block">
          Gérer les fonctionnalités
        </Link>
      </div>
    );
  }

  const renderModule = (id: ModuleId): React.ReactNode => {
    switch (id) {
      case "today":
        return (
          <section aria-labelledby="today-title" className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
              <h2 id="today-title" className="text-lg font-semibold">
                Ce qui t&apos;attend aujourd&apos;hui
              </h2>
              {!dayLoading && visibleEntries.length > 0 && (
                <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                  {visibleEntries.length} {visibleEntries.length > 1 ? "choses" : "chose"}
                </span>
              )}
            </div>

            {dayLoading ? (
              <div className="px-5 pb-5 space-y-3" aria-busy="true" aria-label="Chargement de la journée">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : visibleEntries.length === 0 ? (
              <div className="px-5 pb-6 pt-2">
                <p className="font-medium">Rien de prévu aujourd&apos;hui.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Une chose te trotte dans la tête ? Note-la ci-dessous, le foyer la verra.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {visibleEntries.map((entry) => (
                  <DayRow
                    key={entry.key}
                    entry={entry}
                    byId={profiles.byId}
                    onComplete={completeTodo}
                  />
                ))}
              </ul>
            )}

            {flags.todos && (
              <form onSubmit={addTodo} className="flex items-center gap-2 border-t border-border/60 bg-secondary/40 px-3 py-3">
                <Plus className="h-4 w-4 text-muted-foreground shrink-0 ml-1" aria-hidden="true" />
                <Input
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  placeholder="Ajouter une chose à faire…"
                  aria-label="Ajouter une tâche à faire"
                  enterKeyHint="done"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-1"
                  disabled={adding}
                />
              </form>
            )}
          </section>
        );
      case "meals":
        return <MealsCard meals={meals} />;
      case "lists":
        return (
          <AsideCard title="Courses" icon={ShoppingCart} href="/lists" linkLabel="Voir les listes">
            {activeLists.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tout est coché.</p>
            ) : (
              <ul className="space-y-1.5">
                {activeLists.slice(0, 3).map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{l.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {l.remaining} {l.remaining > 1 ? "articles" : "article"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AsideCard>
        );
      case "week":
        return (
          <AsideCard title="Cette semaine" icon={CalendarDays} href="/calendar" linkLabel="Ouvrir l'agenda">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Rien de prévu les 7 prochains jours.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((e) => (
                  <li key={`${e.id}-${e.date}`} className="flex items-center gap-3 text-sm">
                    <span className="w-14 shrink-0 text-muted-foreground tabular-nums first-letter:uppercase">
                      {format(new Date(e.date), "EEE d", { locale: fr })}
                    </span>
                    <span className="truncate flex-1">{e.title}</span>
                    <AssigneeAvatars ids={e.assigneeIds} byId={profiles.byId} />
                  </li>
                ))}
              </ul>
            )}
          </AsideCard>
        );
      case "weather":
        return weather ? (
          <section aria-label={`Météo${weather.city ? ` à ${weather.city}` : ""}`} className="bg-card border border-border rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{weather.city ?? "Météo"}</p>
                <p className="text-sm text-muted-foreground">
                  {getWeatherInfo(weather.current.weather_code).label}, ressenti{" "}
                  {Math.round(weather.current.apparent_temperature)}°
                </p>
              </div>
              <div className="flex gap-3">
                {weather.daily.time.slice(1, 4).map((day, i) => {
                  const idx = i + 1;
                  const DayIcon = getWeatherInfo(weather.daily.weather_code[idx]).icon;
                  return (
                    <div key={day} className="flex flex-col items-center gap-0.5 text-xs">
                      <span className="text-muted-foreground capitalize">
                        {new Date(day).toLocaleDateString("fr-FR", { weekday: "short" })}
                      </span>
                      <DayIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="tabular-nums">{Math.round(weather.daily.temperature_2m_max[idx])}°</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          <section aria-label="Météo" className="bg-card border border-border rounded-2xl px-5 py-4">
            <p className="text-sm font-medium">Météo</p>
            <p className="text-sm text-muted-foreground mt-1">Chargement de la météo…</p>
          </section>
        );
    }
  };

  const shownCount = layout.filter((s) => s.visible && available.has(s.id)).length;

  return (
    <div className="relative space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Bonjour {firstName}</h1>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="first-letter:uppercase">{dateLabel}</span>
            {/* Le séparateur voyage avec l'élément qu'il précède : jamais seul en fin de ligne. */}
            {currentGroup && (
              <span className="whitespace-nowrap">
                <span aria-hidden="true" className="mr-2">·</span>
                {currentGroup.name}
              </span>
            )}
            {weather && WeatherIcon && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span aria-hidden="true" className="mr-1">·</span>
                <WeatherIcon className="h-4 w-4" aria-hidden="true" />
                {Math.round(weather.current.temperature_2m)}°
                <span className="sr-only">, {getWeatherInfo(weather.current.weather_code).label}</span>
              </span>
            )}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Personnaliser l'accueil"
            title="Personnaliser l'accueil"
            className="mt-1 flex h-9 w-9 touch:h-10 touch:w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <LayoutDashboard className="h-4 w-4" />
          </button>
        )}
      </header>

      {editing && (
        <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] md:top-4 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-sm">
          <div className="flex-1 min-w-[12rem]">
            <p className="text-sm font-semibold">Personnalise ton accueil</p>
            <p className="text-xs text-muted-foreground">
              <span className="hidden md:inline">Glisse un module ou utilise les flèches, choisis sa largeur, ou masque-le.</span>
              <span className="md:hidden">Utilise les flèches pour réordonner, ou masque un module.</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={resetLayout} disabled={!customLayout}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Réinitialiser
          </Button>
          <Button size="sm" onClick={() => setEditing(false)}>
            <Check className="h-4 w-4 mr-1.5" />
            Terminé
          </Button>
        </div>
      )}

      {shownCount === 0 && !editing ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-medium">Ton accueil est vide.</p>
          <p className="text-sm text-muted-foreground mt-1">Tous les modules sont masqués.</p>
          <Button size="sm" className="mt-4" onClick={() => setEditing(true)}>
            Choisir les modules
          </Button>
        </div>
      ) : (
        <ModuleGrid
          layout={layout}
          available={available}
          editing={editing}
          renderModule={renderModule}
          onChange={changeLayout}
        />
      )}

      {!editing && <InstallPrompt />}
    </div>
  );
}

function DayRow({
  entry,
  byId,
  onComplete,
}: {
  entry: DayEntry;
  byId: ReturnType<typeof useFamilyProfiles>["byId"];
  onComplete: (todo: Todo) => void;
}) {
  const isTodo = entry.kind === "todo";
  const title = isTodo ? entry.todo.title : entry.event.title;
  const assignees = isTodo ? entry.todo.assigneeIds : entry.event.assigneeIds;

  return (
    <li className="flex items-center gap-3 px-5 py-3 min-h-[3.25rem]">
      <span
        className={cn(
          "w-[4.5rem] shrink-0 text-sm tabular-nums",
          isTodo && entry.late ? "text-destructive font-medium" : "text-muted-foreground"
        )}
      >
        {entry.label}
      </span>

      {isTodo ? (
        <Checkbox
          checked={false}
          onCheckedChange={() => onComplete(entry.todo)}
          aria-label={`Cocher « ${title} »`}
          className="touch:h-5 touch:w-5"
        />
      ) : (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full shrink-0 mx-[3px] bg-primary"
          style={entry.event.displayColor || entry.event.color ? { backgroundColor: (entry.event.displayColor || entry.event.color)! } : undefined}
        />
      )}

      {isTodo ? (
        <span className="flex-1 min-w-0 text-sm font-medium truncate">{title}</span>
      ) : (
        <Link href="/calendar" className="flex-1 min-w-0 text-sm font-medium truncate hover:underline underline-offset-2">
          {title}
          <span className="sr-only"> (rendez-vous)</span>
        </Link>
      )}

      <AssigneeAvatars ids={assignees} byId={byId} />
    </li>
  );
}

function AsideCard({
  title,
  icon: Icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: typeof ShoppingCart;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="bg-card border border-border rounded-2xl px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </h2>
        <Link
          href={href}
          aria-label={linkLabel}
          className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded-md"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function MealsCard({ meals }: { meals: Meal[] }) {
  const slots: Array<{ slot: Meal["slot"]; label: string }> = [
    { slot: "lunch", label: "Midi" },
    { slot: "dinner", label: "Soir" },
  ];
  const planned = slots
    .map((s) => ({ ...s, items: meals.filter((m) => m.slot === s.slot) }))
    .filter((s) => s.items.length > 0);

  return (
    <AsideCard title="Au menu aujourd'hui" icon={UtensilsCrossed} href="/recipes" linkLabel="Voir les recettes">
      {planned.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Rien de prévu.{" "}
          <Link href="/recipes" className="text-foreground underline underline-offset-2">
            Planifier un repas
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {planned.map((s) => (
            <li key={s.slot} className="flex items-start gap-3 text-sm">
              <span className="w-10 shrink-0 text-muted-foreground">{s.label}</span>
              <span className="flex-1 min-w-0 space-y-1">
                {s.items.map((m) =>
                  m.recipe ? (
                    <Link
                      key={m.id}
                      href={`/recipes/${m.recipe.id}`}
                      className="flex items-center gap-1.5 font-medium hover:underline underline-offset-2"
                    >
                      <ChefHat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{m.recipe.title}</span>
                    </Link>
                  ) : (
                    <span key={m.id} className="block truncate">{m.note}</span>
                  )
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AsideCard>
  );
}
