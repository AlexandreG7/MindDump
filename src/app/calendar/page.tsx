"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGroupContext } from "@/components/GroupContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ChevronLeft, ChevronRight, Link2, HelpCircle } from "lucide-react";
import Link from "next/link";
import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { type CalendarEvent, type Subscription, type ViewMode, VIEW_LABELS, isViewMode } from "@/components/calendar/types";
import { occursOn, rangeForView, shiftAnchor, sortEvents, titleForView } from "@/components/calendar/utils";
import { EventList } from "@/components/calendar/EventList";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { MonthGrid, YearGrid } from "@/components/calendar/MonthGrid";
import { AgendaList } from "@/components/calendar/AgendaList";
import { EventDialog, emptyDraft, type EventDraft } from "@/components/calendar/EventDialog";
import { FeedExportButton } from "@/components/calendar/FeedExportButton";
import { SubscriptionChips, SubscriptionDialog } from "@/components/calendar/Subscriptions";
import { PeopleFilter, matchesPeople, useFamilyProfiles } from "@/components/profiles/Assignees";

const VIEW_KEY = "calendar:view";
const PEOPLE_KEY = "calendar:people";
const VIEW_ORDER: ViewMode[] = ["day", "week", "month", "agenda", "year"];

/** Vue au premier affichage : ?view=, sinon la dernière utilisée, sinon liste sur téléphone et mois ailleurs. */
function initialView(): ViewMode {
  const fromUrl = new URLSearchParams(window.location.search).get("view");
  if (isViewMode(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (isViewMode(saved)) return saved;
  } catch {}
  return window.matchMedia("(max-width: 640px)").matches ? "agenda" : "month";
}

function initialAnchor(): Date {
  const fromUrl = new URLSearchParams(window.location.search).get("date");
  const parsed = fromUrl ? parseISO(fromUrl) : null;
  return parsed && isValid(parsed) ? parsed : new Date();
}

/**
 * Date envoyée à l'API, toujours avec fuseau pour ne pas dépendre de celui du
 * serveur. Journée entière : minuit UTC (convention partagée avec le MCP et le
 * flux ICS). Horaire : l'instant saisi dans le fuseau du navigateur.
 */
function toApiDate(date: string, time: string): string {
  return time ? new Date(`${date}T${time}`).toISOString() : `${date}T00:00:00.000Z`;
}

export default function CalendarPage() {
  const { isReady } = useAuth();
  const { currentGroupId, currentGroup } = useGroupContext();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<ViewMode | null>(null);
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft());
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const requestId = useRef(0);
  const profiles = useFamilyProfiles(currentGroupId);
  const [peopleFilter, setPeopleFilter] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PEOPLE_KEY) ?? "[]");
      if (Array.isArray(saved)) setPeopleFilter(saved.filter((v) => typeof v === "string"));
    } catch {}
  }, []);

  const changePeopleFilter = (ids: string[]) => {
    setPeopleFilter(ids);
    try {
      localStorage.setItem(PEOPLE_KEY, JSON.stringify(ids));
    } catch {}
  };

  // Vue et date lues côté client seulement (URL, préférence, taille d'écran).
  useEffect(() => {
    const v = initialView();
    const a = initialAnchor();
    setView(v);
    setAnchor(a);
    if (v === "day") setSelectedDate(a);
  }, []);

  // L'URL reflète la vue affichée : un lien (ou une notification) peut ouvrir un jour précis.
  useEffect(() => {
    if (!view) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    url.searchParams.set("date", format(anchor, "yyyy-MM-dd"));
    window.history.replaceState(null, "", url);
  }, [view, anchor]);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
    if (next === "day") {
      const day = selectedDate ?? anchor;
      setAnchor(day);
      setSelectedDate(day);
    } else if (selectedDate) {
      setAnchor(selectedDate);
    }
  };

  // Abonnements (calendriers externes) : la liste, puis leurs événements de l'intervalle affiché.
  const fetchSubscriptions = useCallback(() => {
    fetch("/api/calendar/subscriptions")
      .then((r) => r.json())
      .then((subs: Subscription[]) => setSubscriptions(subs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isReady) fetchSubscriptions();
  }, [isReady, fetchSubscriptions]);

  const addSubscription = async (sub: { name: string; url: string }) => {
    await fetch("/api/calendar/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sub, groupId: currentGroupId }),
    });
    fetchSubscriptions();
  };

  const deleteSubscription = async (id: string) => {
    await fetch(`/api/calendar/subscriptions/${id}`, { method: "DELETE" });
    setExternalEvents((prev) => prev.filter((e) => e.subscriptionId !== id));
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  };

  // Événements MindDump de l'intervalle affiché
  const range = useMemo(() => (view ? rangeForView(view, anchor) : null), [view, anchor]);

  const fetchEvents = useCallback(() => {
    if (!range) return;
    const id = ++requestId.current;
    const params = new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
    fetch(`/api/calendar?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CalendarEvent[]) => {
        // Une réponse lente d'une vue précédente ne remplace pas la vue courante.
        if (id === requestId.current) setEvents(data);
      })
      .catch(() => {});
  }, [range]);

  useEffect(() => {
    if (isReady) fetchEvents();
  }, [isReady, fetchEvents]);

  // Séries des calendriers externes développées côté serveur sur l'intervalle affiché.
  useEffect(() => {
    if (!range) return;
    const active = subscriptions.filter((s) => s.enabled);
    const ids = new Set(active.map((s) => s.id));
    setExternalEvents((prev) => prev.filter((e) => e.subscriptionId && ids.has(e.subscriptionId)));
    const params = new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
    let cancelled = false;
    for (const sub of active) {
      fetch(`/api/calendar/subscriptions/${sub.id}?${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || !data.events) return;
          setExternalEvents((prev) => [...prev.filter((e) => e.subscriptionId !== sub.id), ...data.events]);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [subscriptions, range]);

  const openNewEvent = (day?: Date, hour?: number) => {
    const date = format(day ?? selectedDate ?? new Date(), "yyyy-MM-dd");
    const time = hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "";
    const next = emptyDraft(date, time);
    if (hour !== undefined) next.endTime = `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:${hour === 23 ? "59" : "00"}`;
    setDraft(next);
    setDialogOpen(true);
  };

  const addEvent = async (d: EventDraft) => {
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: d.title,
        description: d.description || null,
        date: toApiDate(d.date, d.time),
        endDate: d.time && d.endTime ? toApiDate(d.date, d.endTime) : null,
        allDay: !d.time,
        recurrence: d.recurrence || null,
        color: d.color || null,
        groupId: currentGroupId,
        notifyBefore: d.notifyBefore ? Number(d.notifyBefore) : null,
        assigneeIds: d.assigneeIds,
      }),
    });
    fetchEvents();
  };

  // Les occurrences generees d'un evenement recurrent ont un id suffixe
  // (`<id>_<date iso>`) : on agit toujours sur l'evenement source.
  const baseEventId = (id: string) => id.split("_")[0];

  const deleteEvent = async (id: string) => {
    await fetch(`/api/calendar/${baseEventId(id)}`, { method: "DELETE" });
    fetchEvents();
  };

  const setEventColor = async (id: string, color: string | null) => {
    await fetch(`/api/calendar/${baseEventId(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    fetchEvents();
  };

  const setEventAssignees = async (id: string, assigneeIds: string[]) => {
    // Mise à jour immédiate de toutes les occurrences affichées, puis rechargement.
    const base = baseEventId(id);
    setEvents((prev) => prev.map((e) => (baseEventId(e.id) === base ? { ...e, assigneeIds } : e)));
    await fetch(`/api/calendar/${base}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeIds }),
    });
    fetchEvents();
  };

  // Filtre « qui », limité aux personnes encore affichables.
  const activeFilter = peopleFilter.filter((id) => profiles.assignable.some((p) => p.id === id));

  const allEvents = useMemo(
    () =>
      [...events, ...externalEvents]
        .filter((e) => matchesPeople(e.assigneeIds, activeFilter))
        .map((e) => ({
          ...e,
          displayColor: e.color ?? profiles.byId.get(e.assigneeIds?.[0] ?? "")?.color ?? null,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, externalEvents, activeFilter.join(","), profiles.all]
  );
  const listProfiles = { all: profiles.all, byId: profiles.byId };

  if (!isReady || !view || !range) return null;

  const selectedEvents = selectedDate ? sortEvents(allEvents.filter((e) => occursOn(e, selectedDate))) : [];
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor, { weekStartsOn: 1 }), i));

  const goToday = () => {
    const today = new Date();
    setAnchor(today);
    setSelectedDate(view === "agenda" || view === "year" ? null : today);
  };

  const shift = (direction: 1 | -1) => {
    const next = shiftAnchor(view, anchor, direction);
    setAnchor(next);
    if (view === "day") setSelectedDate(next);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setSubDialogOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            title="Importer un calendrier externe"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <Link
            href="/docs#calendrier"
            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            title="Documentation"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
          <FeedExportButton />
          <Button onClick={() => openNewEvent()} aria-label="Nouvel événement" className="px-3 sm:px-4">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nouvel événement</span>
          </Button>
        </div>
      </div>

      <SubscriptionDialog
        open={subDialogOpen}
        onOpenChange={setSubDialogOpen}
        groupName={currentGroup?.name ?? null}
        onSubmit={addSubscription}
      />
      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={draft}
        profiles={profiles.assignable}
        onSubmit={addEvent}
      />

      <SubscriptionChips subscriptions={subscriptions} onDelete={deleteSubscription} />

      <PeopleFilter profiles={profiles.assignable} value={activeFilter} onChange={changePeopleFilter} />

      {/* Navigation et choix de la vue */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Période précédente">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Période suivante">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} className="ml-1">
            Aujourd&apos;hui
          </Button>
          <h2 className="basis-full sm:basis-auto order-last sm:order-none text-base sm:text-lg font-semibold first-letter:uppercase sm:ml-2 mt-1 sm:mt-0">
            {titleForView(view, anchor)}
          </h2>
        </div>
        <div className="flex items-center bg-secondary rounded-lg p-0.5" role="tablist" aria-label="Vue">
          {VIEW_ORDER.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => changeView(v)}
              className={`px-2.5 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                view === v ? "bg-background shadow-sm text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <MonthGrid month={anchor} events={allEvents} selectedDate={selectedDate} onSelectDay={setSelectedDate} />
      )}

      {(view === "week" || view === "day") && (
        <TimeGrid
          days={view === "day" ? [anchor] : weekDays}
          events={allEvents}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
          onCreateAt={openNewEvent}
        />
      )}

      {view === "agenda" && (
        <AgendaList
          from={anchor}
          events={allEvents}
          onSetColor={setEventColor}
          onSetAssignees={setEventAssignees}
          onDelete={deleteEvent}
          profiles={listProfiles}
        />
      )}

      {view === "year" && (
        <YearGrid
          year={anchor.getFullYear()}
          events={allEvents}
          onSelectMonth={(month) => {
            setAnchor(month);
            changeView("month");
          }}
        />
      )}

      {/* Détail du jour sélectionné */}
      {selectedDate && (view === "month" || view === "week" || view === "day") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg first-letter:uppercase">
              {format(selectedDate, "EEEE d MMMM", { locale: fr })}
            </CardTitle>
            <button
              onClick={() => openNewEvent(selectedDate)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Ajouter ce jour-là"
            >
              <Plus className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun événement ce jour</p>
            ) : (
              <EventList
                events={selectedEvents}
                day={selectedDate}
                onSetColor={setEventColor}
                onSetAssignees={setEventAssignees}
                onDelete={deleteEvent}
                profiles={listProfiles}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
