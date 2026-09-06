"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckSquare,
  Calendar,
  ShoppingCart,
  ChefHat,
  AlertCircle,
  Clock,
  CloudSun,
  Droplets,
  Wind,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Snowflake,
  CloudDrizzle,
} from "lucide-react";
import { useFeaturesContext } from "@/components/FeaturesContext";

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
  priority: string;
  completed: boolean;
  dueDate: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
}

interface ShoppingList {
  id: string;
  name: string;
  type: string;
  items: { id: string; checked: boolean }[];
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
}

export default function Dashboard() {
  const { session, status, isReady } = useAuth();
  const { flags, loading: flagsLoading } = useFeaturesContext();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!isReady || flagsLoading) return;
    if (flags.todos)    fetch("/api/todos").then((r) => r.json()).then(setTodos);
    if (flags.calendar) fetch("/api/calendar").then((r) => r.json()).then(setEvents);
    if (flags.lists)    fetch("/api/lists").then((r) => r.json()).then(setLists);

    const fetchWeather = (lat?: number, lon?: number) => {
      const params = new URLSearchParams();
      if (lat != null && lon != null) {
        params.set("lat", lat.toString());
        params.set("lon", lon.toString());
      }
      fetch(`/api/weather?${params}`).then((r) => r.ok ? r.json() : null).then((d) => d && setWeather(d));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(),
        { timeout: 3000 }
      );
    } else {
      fetchWeather();
    }
  }, [isReady, flagsLoading, flags.todos, flags.calendar, flags.lists]);

  if (status === "loading" || flagsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!session && !isReady) return null;

  const urgentTodos = todos.filter((t) => t.priority === "URGENT" && !t.completed);
  const todayEvents = events.filter(
    (e) => new Date(e.date).toDateString() === new Date().toDateString()
  );
  const upcomingEvents = events
    .filter((e) => new Date(e.date) > new Date())
    .slice(0, 5);
  const activeListsCount = lists.filter((l) => l.items.some((i) => !i.checked)).length;

  const summaryCards = [
    {
      feature: "todos" as const,
      href: "/todos",
      title: "Urgent",
      icon: AlertCircle,
      iconClass: "text-destructive",
      value: urgentTodos.length,
      label: "tâches urgentes",
    },
    {
      feature: "calendar" as const,
      href: "/calendar",
      title: "Aujourd'hui",
      icon: Calendar,
      iconClass: "text-primary",
      value: todayEvents.length,
      label: "événements",
    },
    {
      feature: "lists" as const,
      href: "/lists",
      title: "Courses",
      icon: ShoppingCart,
      iconClass: "text-primary",
      value: activeListsCount,
      label: "listes actives",
    },
    {
      feature: "recipes" as const,
      href: "/recipes",
      title: "Recettes",
      icon: ChefHat,
      iconClass: "text-primary",
      value: null,
      label: "gérer mes recettes",
    },
  ].filter((card) => flags[card.feature]);

  const enabledDetailsCount = [flags.todos, flags.calendar].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Bonjour {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">Voici un aperçu de ta journée</p>
      </div>

      {/* Summary cards */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <Link key={card.feature} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className={`h-4 w-4 ${card.iconClass}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {card.value !== null ? (
                      card.value
                    ) : (
                      <card.icon className="h-6 w-6 inline" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Detail widgets */}
      {enabledDetailsCount > 0 && (
        <div className={`grid grid-cols-1 ${enabledDetailsCount === 2 ? "lg:grid-cols-2" : ""} gap-6`}>
          {flags.todos && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5" />
                  Tâches urgentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {urgentTodos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Rien d&apos;urgent, bravo !</p>
                ) : (
                  <ul className="space-y-2">
                    {urgentTodos.slice(0, 5).map((todo) => (
                      <li key={todo.id} className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                        {todo.title}
                      </li>
                    ))}
                    {urgentTodos.length > 5 && (
                      <li className="text-sm text-muted-foreground">
                        +{urgentTodos.length - 5} autres…
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {flags.calendar && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Prochains événements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun événement prévu</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingEvents.map((event) => (
                      <li
                        key={event.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{event.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(event.date).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Weather */}
      {weather && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-5 w-5" />
              Météo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              {/* Current */}
              <div className="flex items-center gap-4">
                {(() => {
                  const info = getWeatherInfo(weather.current.weather_code);
                  const Icon = info.icon;
                  return <Icon className="h-10 w-10 text-primary shrink-0" />;
                })()}
                <div>
                  <div className="text-3xl font-bold">{Math.round(weather.current.temperature_2m)}°C</div>
                  <p className="text-sm text-muted-foreground">
                    {getWeatherInfo(weather.current.weather_code).label}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Droplets className="h-3 w-3" />
                      Ressenti {Math.round(weather.current.apparent_temperature)}°
                    </span>
                    <span className="flex items-center gap-1">
                      <Wind className="h-3 w-3" />
                      {Math.round(weather.current.wind_speed_10m)} km/h
                    </span>
                  </div>
                </div>
              </div>

              {/* 3-day forecast */}
              <div className="flex gap-4 sm:ml-auto">
                {weather.daily.time.slice(1, 4).map((day, i) => {
                  const idx = i + 1;
                  const info = getWeatherInfo(weather.daily.weather_code[idx]);
                  const DayIcon = info.icon;
                  const label = new Date(day).toLocaleDateString("fr-FR", { weekday: "short" });
                  return (
                    <div key={day} className="flex flex-col items-center gap-1 min-w-[3.5rem]">
                      <span className="text-xs text-muted-foreground capitalize">{label}</span>
                      <DayIcon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs font-medium">
                        {Math.round(weather.daily.temperature_2m_max[idx])}° / {Math.round(weather.daily.temperature_2m_min[idx])}°
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {summaryCards.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Toutes les fonctionnalités sont désactivées.</p>
          <Link href="/profile" className="text-sm text-primary hover:underline mt-1 inline-block">
            Gérer les fonctionnalités →
          </Link>
        </div>
      )}
    </div>
  );
}
