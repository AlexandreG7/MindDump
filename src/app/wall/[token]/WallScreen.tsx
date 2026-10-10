"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, endOfDay, format, isToday, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Check,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  PartyPopper,
  ShoppingCart,
  Sun,
  UtensilsCrossed,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { textOn } from "@/components/profiles/ProfileAvatar";
import { daySpan, eventEnd, occursOn, sortEvents } from "@/components/calendar/utils";
import type { WallSnapshot } from "@/lib/wall";

const DAYS = 7;
const REFRESH_MS = 60_000;
const CACHE_KEY = "wall:snapshot";
/** Veille de nuit : écran assombri, horloge seule. Un toucher le rallume 2 minutes. */
const NIGHT_START = 22;
const NIGHT_END = 6;
const WAKE_MS = 2 * 60_000;
/** Délai pendant lequel un élément coché reste affiché et annulable. */
const UNDO_MS = 4000;

type Profile = WallSnapshot["profiles"][number];

function weatherIcon(code: number | null): LucideIcon {
  if (code == null) return Cloud;
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain;
  if (code <= 77 || code === 85 || code === 86) return CloudSnow;
  return CloudLightning;
}

/** Encre ou blanc selon la clarté de la couleur de fond (lisibilité sur jaune, vert…). */
function readCache(): { snapshot: WallSnapshot; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(snapshot: WallSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ snapshot, savedAt: new Date().toISOString() }));
  } catch {}
}

type WallEvent = WallSnapshot["events"][number];

/**
 * Libellés d'un événement un jour donné. Sur plusieurs jours, l'heure n'a de
 * sens que le premier jour (début) et le dernier (fin) ; entre les deux, « Journée ».
 */
function eventLabels(e: WallEvent, day: Date): { time: string; span: string | null } {
  const span = daySpan(e, day);
  const start = new Date(e.date);
  let time: string;
  if (e.allDay) time = "Journée";
  else if (!span) time = format(start, "HH:mm");
  else if (span.index === 1) time = `dès ${format(start, "HH:mm")}`;
  else if (span.index === span.total) {
    const end = format(eventEnd(e), "HH:mm");
    time = end === "23:59" || end === "00:00" ? "Journée" : `jusqu'à ${end}`;
  } else time = "Journée";
  return {
    time,
    span: span
      ? `${span.index}/${span.total} · ${
          span.index === span.total ? "dernier jour" : `jusqu'à ${format(span.lastDay, "EEE", { locale: fr })}`
        }`
      : null,
  };
}

function Avatar({ profile, size = 28 }: { profile: Profile; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5, backgroundColor: profile.color, color: textOn(profile.color) }}
      title={profile.name}
    >
      {profile.emoji || profile.name[0]?.toUpperCase()}
    </span>
  );
}

export function WallScreen({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<WallSnapshot | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);
  const [revoked, setRevoked] = useState(false);
  // Horloge : null au rendu serveur et à l'hydratation (le fuseau du serveur n'est pas
  // celui de la tablette), posée dès le montage avec le fuseau du navigateur.
  const [now, setNow] = useState<Date | null>(null);
  const [wokeAt, setWokeAt] = useState(0);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    const from = startOfDay(new Date());
    const to = endOfDay(addDays(from, DAYS - 1));
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    try {
      const res = await fetch(`/api/wall/${encodeURIComponent(token)}?${params}`, { cache: "no-store" });
      if (res.status === 404) {
        setRevoked(true);
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch {}
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data: WallSnapshot = await res.json();
      if (id !== requestId.current) return;
      setSnapshot(data);
      setSavedAt(new Date());
      setOffline(false);
      writeCache(data);
    } catch {
      setOffline(true);
    }
  }, [token]);

  // Dernier état connu d'abord (démarrage hors ligne), puis rafraîchissement régulier.
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setSnapshot(cached.snapshot);
      setSavedAt(new Date(cached.savedAt));
    }
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // Écran toujours allumé (comme le mode cuisine), redemandé au retour au premier plan.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch {}
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, []);

  const profilesById = useMemo(() => new Map((snapshot?.profiles ?? []).map((p) => [p.id, p])), [snapshot]);

  // Clé du jour dans le fuseau du navigateur ; les jours sont recalculés à son changement seulement.
  const dayKey = now ? format(now, "yyyy-MM-dd") : "";
  const days = useMemo(() => {
    if (!dayKey) return [];
    const start = startOfDay(new Date());
    return Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  }, [dayKey]);

  const hour = now ? now.getHours() : 12;
  const night = !!now && (hour >= NIGHT_START || hour < NIGHT_END) && Date.now() - wokeAt > WAKE_MS;

  // Un appui coche visiblement ; la validation part après UNDO_MS, un second
  // appui l'annule (écran partagé : enfant, geste accidentel).
  const [pending, setPending] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const commit = async (kind: "todos" | "items", id: string) => {
    setSnapshot((s) =>
      !s
        ? s
        : kind === "todos"
          ? { ...s, todos: s.todos.filter((t) => t.id !== id) }
          : { ...s, lists: s.lists.map((l) => ({ ...l, items: l.items.filter((i) => i.id !== id) })) }
    );
    const res = await fetch(`/api/wall/${encodeURIComponent(token)}/${kind}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "todos" ? { completed: true } : { checked: true }),
    }).catch(() => null);
    if (!res?.ok) setOffline(true);
    refresh();
  };

  const tap = (kind: "todos" | "items", id: string) => {
    const key = `${kind}:${id}`;
    const existing = timers.current.get(key);
    setPending((prev) => {
      const next = new Set(prev);
      if (existing) next.delete(key);
      else next.add(key);
      return next;
    });
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(key);
      return;
    }
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        commit(kind, id);
      }, UNDO_MS)
    );
  };

  if (revoked) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-8 text-center">
        <div className="space-y-2 max-w-md">
          <p className="text-2xl font-semibold">Écran déconnecté</p>
          <p className="text-muted-foreground">
            Ce lien a été révoqué ou n&apos;est pas valide. Crée un nouvel écran depuis Groupes dans MindDump.
          </p>
        </div>
      </div>
    );
  }

  if (night) {
    return (
      <button
        className="fixed inset-0 z-[100] bg-black text-neutral-500 flex flex-col items-center justify-center w-full cursor-default"
        onClick={() => setWokeAt(Date.now())}
        aria-label="Rallumer l'écran"
      >
        <span className="text-8xl font-light tabular-nums">{now ? format(now, "HH:mm") : "00:00"}</span>
        <span className="mt-2 text-xl first-letter:uppercase">{now ? format(now, "EEEE d MMMM", { locale: fr }) : "\u00A0"}</span>
      </button>
    );
  }

  const WeatherIcon = weatherIcon(snapshot?.weather?.code ?? null);
  const listItems = (snapshot?.lists ?? []).flatMap((l) => l.items.map((i) => ({ ...i, list: l.name })));
  // Au menu : les repas planifiés du jour, sinon les recettes « prévues » (sans date).
  const todayMeals = (snapshot?.mealPlan ?? []).filter((m) => m.date === dayKey);
  const menu: Array<{ id: string; title: string; image: string | null; slot?: string }> = todayMeals.length
    ? todayMeals
    : (snapshot?.meals ?? []);

  return (
    <div className="fixed inset-0 z-[100] bg-background text-foreground overflow-y-auto">
      <div className="min-h-full flex flex-col gap-4 p-4 md:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* En-tête : heure, date, météo, foyer */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-5">
            <span className="text-6xl md:text-7xl font-semibold tabular-nums leading-none">
              <span className={now ? undefined : "invisible"}>{now ? format(now, "HH:mm") : "00:00"}</span>
            </span>
            <div className="pb-1">
              <p className="text-xl md:text-2xl font-medium first-letter:uppercase">
                {now ? format(now, "EEEE d MMMM", { locale: fr }) : "\u00A0"}
              </p>
              <p className="text-muted-foreground">{snapshot?.group.name ?? " "}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {offline && (
              <span className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                <WifiOff className="h-4 w-4" />
                Hors ligne{savedAt ? ` · mis à jour à ${format(savedAt, "HH:mm")}` : ""}
              </span>
            )}
            {snapshot?.weather?.temperature != null && (
              <div className="flex items-center gap-2">
                <WeatherIcon className="h-10 w-10 text-primary" />
                <div>
                  <p className="text-3xl font-semibold leading-none">{Math.round(snapshot.weather.temperature)}°</p>
                  {snapshot.weather.city && <p className="text-sm text-muted-foreground">{snapshot.weather.city}</p>}
                </div>
              </div>
            )}
          </div>
        </header>

        {!snapshot ? (
          <p className="text-muted-foreground text-lg py-20 text-center">Chargement du tableau…</p>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {/* Semaine */}
            <section className="flex-1 grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 content-stretch" aria-label="Semaine">
              {days.map((day) => {
                const dayEvents = sortEvents(snapshot.events.filter((e) => occursOn(e, day)));
                const dayMeals = (snapshot.mealPlan ?? []).filter((m) => m.date === format(day, "yyyy-MM-dd"));
                const forecast = snapshot.weather?.daily.find((d) => d.day === format(day, "yyyy-MM-dd"));
                const DayIcon = forecast ? weatherIcon(forecast.code) : null;
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "rounded-2xl border p-3 flex flex-col gap-2 min-h-[10rem]",
                      today ? "border-primary bg-primary/5" : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className={cn("font-semibold leading-tight first-letter:uppercase", today && "text-primary")}>
                        {today ? "Aujourd'hui" : format(day, "EEEE", { locale: fr })}
                        <span className="block text-base text-muted-foreground font-normal">{format(day, "d MMMM", { locale: fr })}</span>
                      </p>
                      {forecast && DayIcon && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <DayIcon className="h-5 w-5" aria-hidden />
                          {Math.round(forecast.max)}°
                        </span>
                      )}
                    </div>
                    {dayEvents.length === 0 && dayMeals.length === 0 && (
                      <p className="text-sm text-muted-foreground/70">Rien de prévu</p>
                    )}
                    {dayEvents.map((e) => {
                      const people = e.assigneeIds.map((id) => profilesById.get(id)).filter((p): p is Profile => !!p);
                      const color = e.color ?? people[0]?.color ?? null;
                      const labels = eventLabels(e, day);
                      return (
                        <div
                          key={e.id}
                          className={cn("rounded-xl px-2.5 py-1.5", !color && "bg-secondary/60")}
                          style={color ? { backgroundColor: `${color}26` } : undefined}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium leading-snug">{e.title}</p>
                            {people.length > 0 && (
                              <span className="flex -space-x-1.5">
                                {people.slice(0, 3).map((p) => (
                                  <Avatar key={p.id} profile={p} size={22} />
                                ))}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {labels.time}
                            {e.source ? ` · ${e.source}` : ""}
                          </p>
                          {labels.span && <p className="text-sm font-medium text-foreground/80">{labels.span}</p>}
                        </div>
                      );
                    })}
                    {dayMeals.length > 0 && (
                      <div className="mt-auto pt-2 border-t border-border/60 space-y-1">
                        {dayMeals.map((m) => (
                          <p key={m.id} className="flex items-start gap-1.5 text-sm">
                            <UtensilsCrossed className="h-4 w-4 mt-0.5 text-primary shrink-0" aria-hidden />
                            <span>
                              <span className="text-muted-foreground">{m.slot === "lunch" ? "Midi" : "Soir"} · </span>
                              {m.title}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {/* Colonne pratique */}
            <aside className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
              <section className="rounded-2xl border border-border bg-card p-4">
                <h2 className="font-semibold text-lg mb-2">À faire</h2>
                {snapshot.todos.length === 0 ? (
                  <p className="text-muted-foreground flex items-center gap-2">
                    <PartyPopper className="h-5 w-5 text-primary" aria-hidden />
                    Tout est fait
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {snapshot.todos.slice(0, 10).map((t) => {
                      const people = t.assigneeIds.map((id) => profilesById.get(id)).filter((p): p is Profile => !!p);
                      const done = pending.has(`todos:${t.id}`);
                      return (
                        <li key={t.id}>
                          <button
                            onClick={() => tap("todos", t.id)}
                            aria-pressed={done}
                            aria-label={done ? `Annuler : « ${t.title} » faite` : `Marquer « ${t.title} » comme faite`}
                            className="w-full min-h-14 flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary active:bg-secondary active:scale-[0.98] transition-[background-color,transform] duration-150 motion-reduce:transition-none"
                          >
                            <span
                              className={cn(
                                "w-9 h-9 rounded-full border-[3px] flex items-center justify-center shrink-0 transition-colors",
                                done ? "bg-primary border-primary" : "border-primary/60"
                              )}
                              aria-hidden
                            >
                              {done && <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />}
                            </span>
                            <span className={cn("flex-1 text-lg leading-snug", done && "line-through text-muted-foreground")}>
                              {t.title}
                            </span>
                            {done && <span className="text-base font-semibold text-primary">Annuler</span>}
                            {people.slice(0, 2).map((p) => (
                              <Avatar key={p.id} profile={p} size={24} />
                            ))}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {listItems.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Courses
                  </h2>
                  <ul className="space-y-2">
                    {listItems.slice(0, 15).map((i) => {
                      const done = pending.has(`items:${i.id}`);
                      return (
                        <li key={i.id}>
                          <button
                            onClick={() => tap("items", i.id)}
                            aria-pressed={done}
                            aria-label={done ? `Annuler : « ${i.name} » pris` : `Marquer « ${i.name} » comme pris`}
                            className="w-full min-h-14 flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary active:bg-secondary active:scale-[0.98] transition-[background-color,transform] duration-150 motion-reduce:transition-none"
                          >
                            <span
                              className={cn(
                                "w-8 h-8 rounded-lg border-[3px] flex items-center justify-center shrink-0 transition-colors",
                                done ? "bg-primary border-primary" : "border-primary/60"
                              )}
                              aria-hidden
                            >
                              {done && <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />}
                            </span>
                            <span className={cn("flex-1 text-lg", done && "line-through text-muted-foreground")}>{i.name}</span>
                            {done ? (
                              <span className="text-base font-semibold text-primary">Annuler</span>
                            ) : (
                              i.quantity && <span className="text-sm text-muted-foreground">{i.quantity}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {listItems.length > 15 && (
                    <p className="text-sm text-muted-foreground mt-1">et {listItems.length - 15} autres…</p>
                  )}
                </section>
              )}

              {menu.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
                    Au menu
                  </h2>
                  <ul className="space-y-2">
                    {menu.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        {m.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span className="w-12 h-12 rounded-lg bg-secondary shrink-0" />
                        )}
                        <span className="leading-snug">
                          {m.slot && <span className="block text-sm text-muted-foreground">{m.slot === "lunch" ? "Midi" : "Soir"}</span>}
                          {m.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
