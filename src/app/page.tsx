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
} from "lucide-react";
import { useFeaturesContext } from "@/components/FeaturesContext";

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

export default function Dashboard() {
  const { session, status, isReady } = useAuth();
  const { flags, loading: flagsLoading } = useFeaturesContext();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);

  useEffect(() => {
    if (!isReady || flagsLoading) return;
    if (flags.todos)    fetch("/api/todos").then((r) => r.json()).then(setTodos);
    if (flags.calendar) fetch("/api/calendar").then((r) => r.json()).then(setEvents);
    if (flags.lists)    fetch("/api/lists").then((r) => r.json()).then(setLists);
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
          Bonjour {session.user?.name?.split(" ")[0]}
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
