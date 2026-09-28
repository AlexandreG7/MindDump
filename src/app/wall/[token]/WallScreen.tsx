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
  ShoppingCart,
  Sun,
  UtensilsCrossed,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { occursOn, sortEvents } from "@/components/calendar/utils";
import type { WallSnapshot } from "@/lib/wall";

const DAYS = 7;
const REFRESH_MS = 60_000;
const CACHE_KEY = "wall:snapshot";
/** Veille de nuit : écran assombri, horloge seule. Un toucher le rallume 2 minutes. */
const NIGHT_START = 22;
const NIGHT_END = 6;
const WAKE_MS = 2 * 60_000;

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
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? "#1a1a1a" : "#fff";
}

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

function Avatar({ profile, size = 28 }: { profile: Profile; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5, backgroundColor: profile.color, color: inkOn(profile.color) }}
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
  const [now, setNow] = useState(() => new Date());
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

  const days = useMemo(() => {
    const start = startOfDay(now);
    return Array.from({ length: DAYS }, (_, i) => addDays(start, i));
    // Recalculé au changement de jour seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.toDateString()]);

  const hour = now.getHours();
  const night = (hour >= NIGHT_START || hour < NIGHT_END) && Date.now() - wokeAt > WAKE_MS;

  const toggleTodo = async (id: string) => {
    setSnapshot((s) => (s ? { ...s, todos: s.todos.filter((t) => t.id !== id) } : s));
    const res = await fetch(`/api/wall/${encodeURIComponent(token)}/todos/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    }).catch(() => null);
    if (!res?.ok) setOffline(true);
    refresh();
  };

  const toggleItem = async (id: string) => {
    setSnapshot((s) =>
      s ? { ...s, lists: s.lists.map((l) => ({ ...l, items: l.items.filter((i) => i.id !== id) })) } : s
    );
    const res = await fetch(`/api/wall/${encodeURIComponent(token)}/items/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: true }),
    }).catch(() => null);
    if (!res?.ok) setOffline(true);
    refresh();
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
        <span className="text-8xl font-light tabular-nums">{format(now, "HH:mm")}</span>
        <span className="mt-2 text-xl first-letter:uppercase">{format(now, "EEEE d MMMM", { locale: fr })}</span>
      </button>
    );
  }

  const WeatherIcon = weatherIcon(snapshot?.weather?.code ?? null);
  const listItems = (snapshot?.lists ?? []).flatMap((l) => l.items.map((i) => ({ ...i, list: l.name })));

  return (
    <div className="fixed inset-0 z-[100] bg-background text-foreground overflow-y-auto">
      <div className="min-h-full flex flex-col gap-4 p-4 md:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* En-tête : heure, date, météo, foyer */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-5">
            <span className="text-6xl md:text-7xl font-semibold tabular-nums leading-none">{format(now, "HH:mm")}</span>
            <div className="pb-1">
              <p className="text-xl md:text-2xl font-medium first-letter:uppercase">
                {format(now, "EEEE d MMMM", { locale: fr })}
              </p>
              <p className="text-muted-foreground">{snapshot?.group.name ?? " "}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {offline && (
              <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
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
                        <span className="block text-sm text-muted-foreground font-normal">{format(day, "d MMMM", { locale: fr })}</span>
                      </p>
                      {forecast && DayIcon && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DayIcon className="h-4 w-4" />
                          {Math.round(forecast.max)}°
                        </span>
                      )}
                    </div>
                    {dayEvents.length === 0 && <p className="text-sm text-muted-foreground/70">Rien de prévu</p>}
                    {dayEvents.map((e) => {
                      const people = e.assigneeIds.map((id) => profilesById.get(id)).filter((p): p is Profile => !!p);
                      const color = e.color ?? people[0]?.color ?? null;
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
                            {e.allDay ? "Journée" : format(new Date(e.date), "HH:mm")}
                            {e.source ? ` · ${e.source}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </section>

            {/* Colonne pratique */}
            <aside className="grid gap-4 md:grid-cols-3 items-start">
              <section className="rounded-2xl border border-border bg-card p-4">
                <h2 className="font-semibold text-lg mb-2">À faire</h2>
                {snapshot.todos.length === 0 ? (
                  <p className="text-muted-foreground">Tout est fait 🎉</p>
                ) : (
                  <ul className="space-y-1">
                    {snapshot.todos.slice(0, 10).map((t) => {
                      const people = t.assigneeIds.map((id) => profilesById.get(id)).filter((p): p is Profile => !!p);
                      return (
                        <li key={t.id}>
                          <button
                            onClick={() => toggleTodo(t.id)}
                            className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-secondary active:bg-secondary transition-colors"
                          >
                            <span className="w-7 h-7 rounded-full border-2 border-primary/60 flex items-center justify-center shrink-0">
                              <Check className="h-4 w-4 text-primary opacity-0" />
                            </span>
                            <span className="flex-1 text-base leading-snug">{t.title}</span>
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
                  <ul className="space-y-0.5">
                    {listItems.slice(0, 15).map((i) => (
                      <li key={i.id}>
                        <button
                          onClick={() => toggleItem(i.id)}
                          className="w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary active:bg-secondary transition-colors"
                        >
                          <span className="w-6 h-6 rounded-md border-2 border-primary/60 shrink-0" />
                          <span className="flex-1">{i.name}</span>
                          {i.quantity && <span className="text-sm text-muted-foreground">{i.quantity}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {listItems.length > 15 && (
                    <p className="text-sm text-muted-foreground mt-1">et {listItems.length - 15} autres…</p>
                  )}
                </section>
              )}

              {snapshot.meals.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
                    Au menu
                  </h2>
                  <ul className="space-y-2">
                    {snapshot.meals.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        {m.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span className="w-12 h-12 rounded-lg bg-secondary shrink-0" />
                        )}
                        <span className="leading-snug">{m.title}</span>
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
