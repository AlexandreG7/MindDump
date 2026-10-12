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
  Thermometer,
  UtensilsCrossed,
  Users,
  Wind,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { nativeHaptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import { useFeaturesContext } from "@/components/FeaturesContext";
import { useGroupContext } from "@/components/GroupContext";
import { useFamilyProfiles, AssigneeAvatars } from "@/components/profiles/Assignees";
import { occursOn, sortEvents } from "@/components/calendar/utils";
import type { CalendarEvent } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "@/components/ui/check-circle";
import { QuickAdd } from "@/components/ui/quick-add";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { HeroIconButton } from "@/components/ui/module-hero";
import { DayScene } from "./dashboard/DayScene";
import { useFlip } from "@/lib/motionUi";
import { TONE_CLASSES, type Tone } from "@/components/ui/tone";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedback } from "@/components/ui/feedback";
import { notifyRemindersChanged } from "@/lib/localReminders";
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
      return getJson<(WeatherData & { city?: string | null }) | null>(`/api/weather?${params}`, null).then((d) => {
        if (d) setWeather(d);
        return d;
      });
    };
    getJson<{ weatherLat?: number; weatherLon?: number } | null>("/api/users/me", null).then((me) => {
      if (me?.weatherLat != null && me?.weatherLon != null) {
        fetchWeather(me.weatherLat, me.weatherLon);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // Position acceptée : on la garde (arrondie à ~1 km, la météo n'a pas besoin
            // de plus) pour ne plus redemander l'autorisation à chaque ouverture.
            const lat = Math.round(pos.coords.latitude * 100) / 100;
            const lon = Math.round(pos.coords.longitude * 100) / 100;
            fetchWeather(lat, lon).then((d) =>
              fetch("/api/users/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ weatherLat: lat, weatherLon: lon, weatherCity: d?.city ?? "Ma position" }),
              }).catch(() => null)
            );
          },
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
    nativeHaptic();
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
    notifyRemindersChanged();
    toast(`« ${todo.title} » : fait`, "success", {
      label: "Annuler",
      onClick: async () => {
        await patch(false);
        notifyRemindersChanged();
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

  const addTodo = async (e?: React.FormEvent) => {
    e?.preventDefault();
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

  // Les lignes de la journée glissent (ressort) quand l'une est cochée ou arrive.
  const listRef = useRef<HTMLUListElement>(null);
  useFlip(listRef, dayEntries.filter((e) => e.kind === "event" || !done.has(e.todo.id)).map((e) => e.key).join("|"));

  if (status === "loading" || flagsLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Chargement de l'accueil">
        <Skeleton className="h-[21rem] rounded-[2rem]" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-72 rounded-[2rem]" />
          <Skeleton className="h-72 rounded-[2rem]" />
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

  const remainingItems = activeLists.reduce((n, l) => n + l.remaining, 0);

  const renderModule = (id: ModuleId): React.ReactNode => {
    switch (id) {
      case "today":
        return (
          <section aria-labelledby="today-title" className="overflow-hidden rounded-[2rem] bg-card shadow-surface">
            <div className="flex items-end justify-between gap-3 px-5 pb-2 pt-5">
              <h2 id="today-title" className="font-display text-[2rem] md:text-[2.5rem]">
                Ta journée
              </h2>
              {!dayLoading && visibleEntries.length > 0 && (
                <span className="mb-1 shrink-0 rounded-full bg-tone-todo px-3 py-1 text-sm font-extrabold tabular-nums text-on-tone">
                  {visibleEntries.length} {visibleEntries.length > 1 ? "choses" : "chose"}
                </span>
              )}
            </div>

            {dayLoading ? (
              <div className="space-y-3 px-5 pb-4" aria-busy="true" aria-label="Chargement de la journée">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-2xl" />
                ))}
              </div>
            ) : visibleEntries.length === 0 ? (
              <EmptyState icon={Check} tone="todo" title="Journée rangée." className="py-6">
                Une chose te trotte dans la tête ? Note-la ci-dessous, le foyer la verra.
              </EmptyState>
            ) : (
              <ul ref={listRef} className="relative px-2 pb-2">
                {visibleEntries.map((entry) => (
                  <DayRow key={entry.key} flipKey={entry.key} entry={entry} byId={profiles.byId} onComplete={completeTodo} />
                ))}
              </ul>
            )}

            {flags.todos && (
              <div className="p-3 pt-1">
                <QuickAdd
                  value={quickAdd}
                  onChange={setQuickAdd}
                  onSubmit={() => addTodo()}
                  placeholder="Ajouter une chose à faire…"
                  label="Ajouter une tâche à faire"
                  disabled={adding}
                />
              </div>
            )}
          </section>
        );
      case "meals":
        return <MealsCard meals={meals} />;
      case "lists":
        return (
          <BlockCard tone="list" title="Courses" href="/lists" linkLabel="Voir les listes" icon={ShoppingCart}>
            {activeLists.length === 0 ? (
              <p className="text-2xl font-extrabold leading-tight text-balance">Tout est dans le chariot.</p>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <AnimatedNumber value={remainingItems} className="font-display text-[4.5rem] leading-none" />
                  <p className="pb-1.5 text-base font-bold leading-tight">{remainingItems > 1 ? "articles" : "article"}<br />à prendre</p>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {activeLists.slice(0, 3).map((l) => (
                    <li key={l.id}>
                      <Link
                        href="/lists"
                        className="flex min-h-12 items-center justify-between gap-3 rounded-full bg-on-tone/[0.12] px-4 text-base font-bold transition-[transform,background-color] hover:bg-on-tone/20 active:scale-[0.98]"
                      >
                        <span className="truncate">{l.name}</span>
                        <span className="shrink-0 rounded-full bg-on-tone px-2.5 py-0.5 text-sm font-extrabold tabular-nums text-tone-list">
                          {l.remaining}
                          <span className="sr-only"> {l.remaining > 1 ? "articles" : "article"}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </BlockCard>
        );
      case "week":
        return (
          <BlockCard tone="agenda" title="Cette semaine" href="/calendar" linkLabel="Ouvrir l'agenda" icon={CalendarDays}>
            {upcoming.length === 0 ? (
              <p className="text-2xl font-extrabold leading-tight text-balance">Rien de prévu les 7 prochains jours.</p>
            ) : (
              <ul className="space-y-1.5">
                {upcoming.map((e) => (
                  <li key={`${e.id}-${e.date}`} className="flex min-h-14 items-center gap-3 text-base">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-on-tone leading-none text-tone-agenda">
                      <span className="text-[0.625rem] font-extrabold uppercase">
                        {format(new Date(e.date), "EEE", { locale: fr }).replace(".", "")}
                      </span>
                      <span className="mt-0.5 text-lg font-extrabold tabular-nums">{format(new Date(e.date), "d")}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">{e.title}</span>
                    <AssigneeAvatars ids={e.assigneeIds} byId={profiles.byId} />
                  </li>
                ))}
              </ul>
            )}
          </BlockCard>
        );
      case "weather":
        return <WeatherCard weather={weather} />;
    }
  };

  const shownCount = layout.filter((s) => s.visible && available.has(s.id)).length;

  return (
    <div className="relative space-y-5 md:space-y-6">
      <DayScene
        dateLabel={dateLabel}
        greeting={
          <>
            Bonjour
            <br />
            {firstName}
          </>
        }
        count={showDay ? (dayLoading ? null : visibleEntries.length) : 0}
        countLabel={visibleEntries.length === 1 ? "chose aujourd'hui" : "choses aujourd'hui"}
        action={
          !editing ? (
            <HeroIconButton
              onClick={() => setEditing(true)}
              aria-label="Personnaliser l'accueil"
              title="Personnaliser l'accueil"
              className="h-11 w-11 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20 focus-visible:ring-ink-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
            </HeroIconButton>
          ) : null
        }
      >
        {currentGroup && (
          <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-ink-foreground/10 px-3 text-sm font-bold">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{currentGroup.name}</span>
          </span>
        )}
        {weather && WeatherIcon && (
          <span
            role="img"
            title={getWeatherInfo(weather.current.weather_code).label}
            aria-label={`${Math.round(weather.current.temperature_2m)} degrés, ${getWeatherInfo(weather.current.weather_code).label}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-tone-meal px-3 text-sm font-extrabold tabular-nums text-on-tone"
          >
            <WeatherIcon className="h-4 w-4" aria-hidden="true" />
            {Math.round(weather.current.temperature_2m)}°
            <span className="hidden font-semibold sm:inline">{getWeatherInfo(weather.current.weather_code).label}</span>
          </span>
        )}
      </DayScene>

      {editing && (
        <div className="sticky top-[calc(4.5rem+env(safe-area-inset-top))] md:top-4 z-30 flex flex-wrap items-center gap-3 rounded-[1.5rem] bg-card/95 backdrop-blur px-4 py-3 shadow-surface">
          <div className="flex-1 min-w-[12rem]">
            <p className="text-base font-extrabold">Personnalise ton accueil</p>
            <p className="text-sm text-muted-foreground">
              <span className="hidden md:inline">Glisse un module ou utilise les flèches, choisis sa largeur, ou masque-le.</span>
              <span className="md:hidden">Utilise les flèches pour réordonner, ou masque un module.</span>
            </p>
          </div>
          <Button variant="ghost" onClick={resetLayout} disabled={!customLayout} className="h-11 rounded-full px-4">
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Réinitialiser
          </Button>
          <Button onClick={() => setEditing(false)} className="h-11 rounded-full px-5">
            <Check className="h-4 w-4 mr-1.5" />
            Terminé
          </Button>
        </div>
      )}

      {shownCount === 0 && !editing ? (
        <div className="rounded-[2rem] border-2 border-dashed border-border px-6 py-12 text-center">
          <p className="font-display text-2xl">Ton accueil est vide.</p>
          <p className="mt-1 text-base text-muted-foreground">Tous les modules sont masqués.</p>
          <Button className="mt-4 h-12 rounded-full px-6" onClick={() => setEditing(true)}>
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
  flipKey,
  byId,
  onComplete,
}: {
  entry: DayEntry;
  flipKey: string;
  byId: ReturnType<typeof useFamilyProfiles>["byId"];
  onComplete: (todo: Todo) => void;
}) {
  const isTodo = entry.kind === "todo";
  const title = isTodo ? entry.todo.title : entry.event.title;
  const assignees = isTodo ? entry.todo.assigneeIds : entry.event.assigneeIds;
  const eventColor = !isTodo ? entry.event.displayColor || entry.event.color : null;
  const timed = /^\d{2}:\d{2}$/.test(entry.label);

  return (
    <li data-flip={flipKey} className="flex min-h-[4rem] items-center gap-1 rounded-[1.25rem] py-2 pl-1 pr-3 transition-colors hover:bg-accent/50">
      {isTodo ? (
        <CheckCircle tone="todo" checked={false} onCheckedChange={() => onComplete(entry.todo)} aria-label={`Cocher « ${title} »`} />
      ) : (
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center">
          <span className="h-9 w-2 rounded-full bg-tone-agenda" style={eventColor ? { backgroundColor: eventColor } : undefined} />
        </span>
      )}

      <div className="min-w-0 flex-1 pl-1">
        {isTodo ? (
          <p className="line-clamp-2 text-[1.0625rem] font-bold leading-snug">{title}</p>
        ) : (
          <Link href="/calendar" className="line-clamp-2 text-[1.0625rem] font-bold leading-snug hover:underline underline-offset-2">
            {title}
            <span className="sr-only"> (rendez-vous)</span>
          </Link>
        )}
        <p
          className={cn(
            "mt-0.5 text-sm tabular-nums",
            isTodo && entry.late ? "font-extrabold text-destructive" : timed ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground"
          )}
        >
          {entry.label}
        </p>
      </div>

      <AssigneeAvatars ids={assignees} byId={byId} className="[&>*]:h-8 [&>*]:w-8 [&>*]:text-sm" />
    </li>
  );
}

/** Module de l'accueil à l'aplat de sa teinte : titre en 800, contenu, flèche d'accès. */
function BlockCard({
  tone,
  title,
  href,
  linkLabel,
  icon: Icon,
  children,
}: {
  tone: Tone;
  title: string;
  href: string;
  linkLabel: string;
  icon: typeof ShoppingCart;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("relative overflow-hidden rounded-[2rem] p-5", TONE_CLASSES[tone].block)}>
      <Icon aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-5 h-36 w-36 rotate-[-12deg] opacity-[0.1]" strokeWidth={1.5} />
      <div className="relative mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[1.75rem]">{title}</h2>
        <Link
          href={href}
          aria-label={linkLabel}
          className="-mr-1 flex h-12 w-12 items-center justify-center rounded-full bg-on-tone/[0.12] transition-[transform,background-color] hover:bg-on-tone/20 active:scale-90"
        >
          <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
        </Link>
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

function WeatherCard({ weather }: { weather: WeatherData | null }) {
  const header = (
    <h2 className="flex min-w-0 items-center gap-2 text-base font-extrabold">
      <CloudSun className="h-5 w-5 shrink-0" aria-hidden="true" />
      Météo
      {weather?.city && <span className="truncate font-semibold text-muted-foreground">· {weather.city}</span>}
    </h2>
  );

  if (!weather) {
    return (
      <section aria-label="Météo" className="space-y-3 rounded-[2rem] bg-card px-5 py-5 shadow-surface">
        {header}
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
      </section>
    );
  }

  const now = getWeatherInfo(weather.current.weather_code);
  const NowIcon = now.icon;

  return (
    <section aria-label={`Météo${weather.city ? ` à ${weather.city}` : ""}`} className="space-y-4 rounded-[2rem] bg-card px-5 py-5 shadow-surface">
      {header}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-tone-meal text-on-tone">
            <NowIcon className="h-9 w-9" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-[3rem] tabular-nums leading-none">{Math.round(weather.current.temperature_2m)}°</p>
            <p className="mt-1.5 text-base font-bold">{now.label}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
                Ressenti {Math.round(weather.current.apparent_temperature)}°
              </span>
              <span className="flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" aria-hidden="true" />
                {Math.round(weather.current.wind_speed_10m)} km/h
              </span>
            </div>
          </div>
        </div>

        <ul className="ml-auto grid min-w-[12rem] max-w-xs flex-1 grid-cols-3 gap-2" aria-label="Prévisions des 3 prochains jours">
          {weather.daily.time.slice(1, 4).map((day, i) => {
            const idx = i + 1;
            const info = getWeatherInfo(weather.daily.weather_code[idx]);
            const DayIcon = info.icon;
            const max = Math.round(weather.daily.temperature_2m_max[idx]);
            const min = Math.round(weather.daily.temperature_2m_min[idx]);
            const weekday = new Date(day).toLocaleDateString("fr-FR", { weekday: "short" });
            return (
              <li
                key={day}
                className="flex flex-col items-center gap-1 rounded-2xl bg-tone-meal-soft px-2 py-2.5 text-tone-meal-ink"
                aria-label={`${new Date(day).toLocaleDateString("fr-FR", { weekday: "long" })} : ${info.label}, ${max}° / ${min}°`}
              >
                <span className="text-xs font-bold capitalize" aria-hidden="true">{weekday}</span>
                <DayIcon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs tabular-nums" aria-hidden="true">
                  <span className="font-extrabold">{max}°</span>
                  <span className="opacity-75"> / {min}°</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function MealsCard({ meals }: { meals: Meal[] }) {
  const slots: Array<{ slot: Meal["slot"]; label: string }> = [
    { slot: "lunch", label: "Ce midi" },
    { slot: "dinner", label: "Ce soir" },
  ];
  const planned = slots
    .map((s) => ({ ...s, items: meals.filter((m) => m.slot === s.slot) }))
    .filter((s) => s.items.length > 0);

  return (
    <BlockCard tone="meal" title="Au menu" href="/recipes" linkLabel="Voir les recettes" icon={UtensilsCrossed}>
      {planned.length === 0 ? (
        <p className="text-xl font-extrabold leading-tight text-balance">
          Rien de prévu.{" "}
          <Link href="/recipes" className="underline decoration-2 underline-offset-4">
            Planifier un repas
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {planned.map((s) => (
            <li key={s.slot}>
              <p className="text-sm font-extrabold opacity-80">{s.label}</p>
              {s.items.map((m) =>
                m.recipe ? (
                  <Link
                    key={m.id}
                    href={`/recipes/${m.recipe.id}`}
                    className="-mx-2 flex min-h-14 items-center gap-2 rounded-2xl px-2 font-display text-[1.625rem] leading-tight tracking-[-0.03em] transition-[transform,background-color] hover:bg-on-tone/[0.08] active:scale-[0.98]"
                  >
                    <span className="min-w-0 flex-1 text-balance">{m.recipe.title}</span>
                    <ChefHat className="h-5 w-5 shrink-0" aria-hidden="true" />
                  </Link>
                ) : (
                  <span key={m.id} className="block min-h-10 py-2 text-lg font-bold">{m.note}</span>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  );
}
