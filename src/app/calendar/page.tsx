"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { notifyRemindersChanged } from "@/lib/localReminders";
import { useGroupContext } from "@/components/GroupContext";
import { Plus, ChevronLeft, ChevronRight, Link2, HelpCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { ModuleHero, HeroChip, HeroIconButton } from "@/components/ui/module-hero";
import { SegmentedNav } from "@/components/ui/segmented-nav";
import { useFeedback } from "@/components/ui/feedback";
import { fr } from "date-fns/locale";
import { type CalendarEvent, type Subscription, type ViewMode, VIEW_LABELS, isViewMode } from "@/components/calendar/types";
import { eventEnd, eventStart, occursOn, rangeForView, resolveEventColor, shiftAnchor, sortEvents, titleForView } from "@/components/calendar/utils";
import { EventList } from "@/components/calendar/EventList";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { MonthGrid, YearGrid } from "@/components/calendar/MonthGrid";
import { AgendaList } from "@/components/calendar/AgendaList";
import { WeekStrip } from "@/components/calendar/WeekStrip";
import { valueToReminder } from "@/lib/reminderOptions";
import { joinDue } from "@/lib/todoDue";
import dynamic from "next/dynamic";
import { draftFromEvent, emptyDraft, type EventDraft } from "@/components/calendar/eventDraft";
import { FeedExportButton } from "@/components/calendar/FeedExportButton";
import { SubscriptionChips } from "@/components/calendar/Subscriptions";
import { PeopleFilter, matchesPeople, useFamilyProfiles } from "@/components/profiles/Assignees";
import { AiImportDialog, useAiImportStatus } from "@/components/import/AiImportDialog";

// Fenêtres ouvertes à la demande : chargées juste après l'affichage, hors du JS initial.
const EventDialog = dynamic(() => import("@/components/calendar/EventDialog").then((m) => m.EventDialog), { ssr: false });
const EventSheet = dynamic(() => import("@/components/calendar/EventSheet").then((m) => m.EventSheet), { ssr: false });
const SubscriptionDialog = dynamic(() => import("@/components/calendar/Subscriptions").then((m) => m.SubscriptionDialog), { ssr: false });

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
  return time ? (joinDue(date, time) ?? `${date}T${time}`) : `${date}T00:00:00.000Z`;
}

/**
 * Fin envoyée à l'API. Journée entière sur plusieurs jours : minuit UTC du
 * lendemain du dernier jour (fin exclusive, comme le flux ICS). Horaire : le
 * dernier jour à l'heure de fin (jusqu'à 23:59 sans heure de fin).
 */
function apiEndDate(d: EventDraft): string | null {
  const multiDay = !!d.endDate && d.endDate > d.date;
  if (!d.time) {
    if (!multiDay) return null;
    const [y, m, day] = d.endDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day + 1)).toISOString();
  }
  if (multiDay) return toApiDate(d.endDate, d.endTime || "23:59");
  return d.endTime ? toApiDate(d.date, d.endTime) : null;
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
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiStatus, setAiStatus] = useAiImportStatus();
  const requestId = useRef(0);
  const detailRef = useRef<HTMLElement>(null);
  const { confirm, toast } = useFeedback();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  // Vue d'ensemble de la semaine en cours (en-tête et bandeau), indépendante de la vue affichée.
  const [glanceOwn, setGlanceOwn] = useState<CalendarEvent[] | null>(null);
  const [glanceExternal, setGlanceExternal] = useState<CalendarEvent[]>([]);
  const [glanceTick, setGlanceTick] = useState(0);
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
    if (v === "day" || v === "week" || v === "month") setSelectedDate(a);
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
    if (next === "day" || next === "week" || next === "month") {
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
      .then((r) => (r.ok ? r.json() : null))
      .then((subs: Subscription[] | null) => {
        if (subs) setSubscriptions(subs);
      })
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
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data?.events) return;
          setExternalEvents((prev) => [...prev.filter((e) => e.subscriptionId !== sub.id), ...data.events]);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [subscriptions, range]);

  // Jour courant, rafraîchi au retour sur l'onglet et à minuit : la semaine en
  // cours (bandeau, en-tête) ne reste pas figée sur celle du chargement.
  const [todayKey, setTodayKey] = useState(() => format(new Date(), "yyyy-MM-dd"));
  useEffect(() => {
    const refresh = () => setTodayKey(format(new Date(), "yyyy-MM-dd"));
    const msToMidnight = () => {
      const n = new Date();
      return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - n.getTime() + 500;
    };
    let timer = window.setTimeout(function tick() {
      refresh();
      timer = window.setTimeout(tick, msToMidnight());
    }, msToMidnight());
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  // Même clé de semaine que le bandeau (lundi de la semaine) : l'intervalle ne change qu'avec elle.
  const weekKey = format(startOfWeek(parseISO(todayKey), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekRange = useMemo(() => rangeForView("week", parseISO(weekKey)), [weekKey]);

  const reload = useCallback(() => {
    fetchEvents();
    setGlanceTick((t) => t + 1);
  }, [fetchEvents]);

  useEffect(() => {
    if (!isReady) return;
    const params = new URLSearchParams({ from: weekRange.from.toISOString(), to: weekRange.to.toISOString() });
    let cancelled = false;
    fetch(`/api/calendar?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CalendarEvent[]) => {
        if (!cancelled) setGlanceOwn(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isReady, weekRange, glanceTick]);

  useEffect(() => {
    const active = subscriptions.filter((s) => s.enabled);
    const params = new URLSearchParams({ from: weekRange.from.toISOString(), to: weekRange.to.toISOString() });
    let cancelled = false;
    setGlanceExternal([]);
    for (const sub of active) {
      fetch(`/api/calendar/subscriptions/${sub.id}?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data?.events) return;
          setGlanceExternal((prev) => [...prev.filter((e) => e.subscriptionId !== sub.id), ...data.events]);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [subscriptions, weekRange]);

  const openNewEvent = (day?: Date, hour?: number) => {
    setEditing(null);
    const date = format(day ?? selectedDate ?? new Date(), "yyyy-MM-dd");
    const time = hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "";
    const next = emptyDraft(date, time);
    if (hour !== undefined) next.endTime = `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:${hour === 23 ? "59" : "00"}`;
    setDraft(next);
    setDialogOpen(true);
  };

  const saveEvent = async (d: EventDraft) => {
    if (editing) {
      // On n'envoie que ce qui a changé : un PATCH complet réécrirait le rappel
      // (ou les dates) d'une série que la personne n'a pas touchés.
      const body: Record<string, unknown> = {};
      if (d.title !== draft.title) body.title = d.title;
      if (d.description !== draft.description) body.description = d.description || null;
      if (d.recurrence !== draft.recurrence) body.recurrence = d.recurrence || null;
      if (d.color !== draft.color) body.color = d.color || null;
      if (d.assigneeIds.join() !== draft.assigneeIds.join()) body.assigneeIds = d.assigneeIds;
      // 0 = à l'heure, null = pas de rappel ; une journée entière n'en a pas.
      if (d.notifyBefore !== draft.notifyBefore || (!d.time && draft.time)) {
        body.notifyBefore = d.time ? valueToReminder(d.notifyBefore) : null;
      }
      // Une occurrence d'une série garde les dates de son événement source.
      const datesChanged =
        d.date !== draft.date || d.time !== draft.time || d.endDate !== draft.endDate || d.endTime !== draft.endTime;
      if (datesChanged && !editing.id.includes("_")) {
        body.date = toApiDate(d.date, d.time);
        body.endDate = apiEndDate(d);
        body.allDay = !d.time;
      }
      if (Object.keys(body).length === 0) return;
      const res = await fetch(`/api/calendar/${editing.id.split("_")[0]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast("La modification a échoué", "error");
        throw new Error("patch");
      }
      toast("Événement modifié", "success");
    } else {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: d.title,
          description: d.description || null,
          recurrence: d.recurrence || null,
          color: d.color || null,
          notifyBefore: d.time ? valueToReminder(d.notifyBefore) : null,
          assigneeIds: d.assigneeIds,
          date: toApiDate(d.date, d.time),
          endDate: apiEndDate(d),
          allDay: !d.time,
          groupId: currentGroupId,
        }),
      }).catch(() => null);
      if (!res || !res.ok) {
        toast("L'événement n'a pas pu être ajouté", "error");
        throw new Error("post");
      }
    }
    reload();
    notifyRemindersChanged();
  };

  const openEdit = (event: CalendarEvent) => {
    setOpenId(null);
    setDraft(draftFromEvent(event));
    setEditing(event);
    setDialogOpen(true);
  };

  // Les occurrences generees d'un evenement recurrent ont un id suffixe
  // (`<id>_<date iso>`) : on agit toujours sur l'evenement source.
  const baseEventId = (id: string) => id.split("_")[0];

  const deleteEvent = async (id: string) => {
    await fetch(`/api/calendar/${baseEventId(id)}`, { method: "DELETE" });
    reload();
    notifyRemindersChanged();
  };

  const requestDelete = async (event: CalendarEvent) => {
    const series = !!event.recurrence && event.recurrence !== "none";
    const ok = await confirm({
      title: `Supprimer « ${event.title} » ?`,
      description: series ? "Toute la série sera supprimée." : undefined,
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    setOpenId(null);
    await deleteEvent(event.id);
    toast("Événement supprimé");
  };

  const setEventColor = async (id: string, color: string | null) => {
    await fetch(`/api/calendar/${baseEventId(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    reload();
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
    reload();
    notifyRemindersChanged();
  };

  // Filtre « qui », limité aux personnes encore affichables.
  const activeFilter = peopleFilter.filter((id) => profiles.assignable.some((p) => p.id === id));

  const decorate = (list: CalendarEvent[]) =>
    list
      .filter((e) => matchesPeople(e.assigneeIds, activeFilter))
      .map((e) => ({
        ...e,
        displayColor: resolveEventColor(e.color, e.assigneeIds, profiles.byId),
      }));

  const allEvents = useMemo(
    () => decorate([...events, ...externalEvents]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, externalEvents, activeFilter.join(","), profiles.all]
  );
  const glanceEvents = useMemo(
    () => decorate([...(glanceOwn ?? []), ...glanceExternal]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [glanceOwn, glanceExternal, activeFilter.join(","), profiles.all]
  );
  const listProfiles = { all: profiles.all, byId: profiles.byId };

  if (!isReady || !view || !range) return null;

  const now = new Date();
  const todayCount = glanceOwn === null ? null : glanceEvents.filter((e) => occursOn(e, now)).length;
  const next = glanceEvents
    .filter((e) => eventEnd(e) > now)
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())[0];
  const nextLabel = (() => {
    if (!next) return null;
    const start = eventStart(next);
    const today = occursOn(next, now);
    const when = [
      today ? (next.allDay ? "Aujourd'hui" : null) : format(start, "EEE d", { locale: fr }),
      next.allDay ? null : format(start, "HH:mm"),
    ]
      .filter(Boolean)
      .join(" ");
    return `${when ? `${when} · ` : ""}${next.title}`;
  })();

  const selectedEvents = selectedDate ? sortEvents(allEvents.filter((e) => occursOn(e, selectedDate))) : [];
  const sheetEvent = openId ? (allEvents.find((e) => e.id === openId) ?? null) : null;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor, { weekStartsOn: 1 }), i));

  // Téléphone : choisir un jour du mois amène son détail à l'écran s'il est sous la grille.
  const pickMonthDay = (day: Date) => {
    setSelectedDate(day);
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    requestAnimationFrame(() => {
      const el = detailRef.current;
      if (!el || el.getBoundingClientRect().top < window.innerHeight * 0.7) return;
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
    });
  };

  const goToday = () => {
    const today = new Date();
    setAnchor(today);
    setSelectedDate(view === "agenda" || view === "year" ? null : today);
  };

  const shift = (direction: 1 | -1) => {
    const next = shiftAnchor(view, anchor, direction);
    setAnchor(next);
    if (view === "day" || view === "week" || view === "month") setSelectedDate(next);
  };

  const changeViewTo = (next: ViewMode, day: Date) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
    setAnchor(day);
    setSelectedDate(day);
  };
  const openDay = (day: Date) => changeViewTo("day", day);

  const iconBtn =
    "grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-[transform,background-color,color] duration-150 hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 md:mx-0">
      <ModuleHero
        tone="agenda"
        title="Agenda"
        kicker={nextLabel && <span className="block truncate">Prochain : {nextLabel}</span>}
        count={todayCount}
        countLabel={todayCount === 0 ? "rien de prévu aujourd'hui" : "aujourd'hui"}
        action={
          <>
            {aiStatus?.enabled && (
              <HeroIconButton
                onClick={() => setAiDialogOpen(true)}
                title="Importer une photo, un PDF ou un texte avec l'IA"
                aria-label="Importer avec l'IA"
              >
                <Sparkles className="h-4 w-4" />
              </HeroIconButton>
            )}
            <HeroIconButton
              onClick={() => openNewEvent()}
              title="Nouvel événement"
              aria-label="Nouvel événement"
              className="bg-on-tone text-tone-agenda hover:bg-on-tone/90"
            >
              <Plus className="h-6 w-6" strokeWidth={3} />
            </HeroIconButton>
          </>
        }
      >
        {glanceOwn !== null && <HeroChip>{glanceEvents.length} cette semaine</HeroChip>}
      </ModuleHero>

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
        onSubmit={saveEvent}
        mode={editing ? "edit" : "create"}
        lockDates={!!editing && editing.id.includes("_")}
      />
      <EventSheet
        event={sheetEvent}
        onOpenChange={(o) => !o && setOpenId(null)}
        profiles={listProfiles}
        onEdit={openEdit}
        onDelete={requestDelete}
        onSetColor={setEventColor}
        onSetAssignees={setEventAssignees}
      />

      <AiImportDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        groupId={currentGroupId}
        profiles={profiles.assignable}
        status={aiStatus}
        onStatusChange={setAiStatus}
        onImported={() => {
          reload();
          notifyRemindersChanged();
        }}
      />

      {view === "agenda" && glanceOwn !== null && <WeekStrip events={glanceEvents} onSelectDay={openDay} selectedId={openId} />}

      <PeopleFilter profiles={profiles.assignable} value={activeFilter} onChange={changePeopleFilter} />

      {/* Choix de la vue, puis navigation dans le temps */}
      <div className="space-y-2.5">
        <SegmentedNav
          label="Vue"
          idPrefix="calendar-view"
          value={view}
          onChange={changeView}
          items={VIEW_ORDER.map((v) => ({ value: v, label: VIEW_LABELS[v] }))}
          className="p-1"
          itemClassName="h-11 px-1 text-sm sm:px-6 sm:text-base"
        />
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => shift(-1)} aria-label="Période précédente" className={iconBtn}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Période suivante" className={iconBtn}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="font-display min-w-0 flex-1 px-2 text-lg leading-tight first-letter:uppercase sm:text-xl sm:leading-7">
            {titleForView(view, anchor)}
          </h2>
          <button
            type="button"
            onClick={goToday}
            className="h-11 shrink-0 rounded-full border border-border bg-card px-4 text-sm font-bold transition-[transform,background-color] duration-150 hover:bg-secondary active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      <div role="tabpanel" id="calendar-view-panel" aria-labelledby={`calendar-view-${view}`} className="space-y-5">
      {view === "month" && (
        <MonthGrid month={anchor} events={allEvents} selectedDate={selectedDate} onSelectDay={pickMonthDay} selectedId={openId} />
      )}

      {(view === "week" || view === "day") && (
        <TimeGrid
          days={view === "day" ? [anchor] : weekDays}
          events={allEvents}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
          onCreateAt={openNewEvent}
          onOpen={(e) => setOpenId(e.id)}
          selectedId={openId}
        />
      )}

      {view === "agenda" && (
        <div className="max-w-3xl">
          <AgendaList
            from={anchor}
            events={allEvents}
            onOpen={(e) => setOpenId(e.id)}
            onSetColor={setEventColor}
            onSetAssignees={setEventAssignees}
            onDelete={requestDelete}
            profiles={listProfiles}
            selectedId={openId}
          />
        </div>
      )}

      {view === "year" && (
        <YearGrid
          year={anchor.getFullYear()}
          events={allEvents}
          onSelectMonth={(month) => changeViewTo("month", month)}
        />
      )}

      {/* Détail du jour sélectionné */}
      {selectedDate && (view === "month" || view === "week" || view === "day") && (
        <section
          ref={detailRef}
          aria-label={format(selectedDate, "EEEE d MMMM", { locale: fr })}
          className="scroll-mb-28 rounded-[1.75rem] border border-border/70 bg-card p-4 sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl first-letter:uppercase">
              {format(selectedDate, "EEEE d MMMM", { locale: fr })}
            </h2>
            <button
              type="button"
              onClick={() => openNewEvent(selectedDate)}
              className={cn(iconBtn, "-mr-2")}
              title="Ajouter ce jour-là"
              aria-label={`Ajouter un événement le ${format(selectedDate, "d MMMM", { locale: fr })}`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-base text-muted-foreground">Aucun événement ce jour</p>
          ) : (
            <EventList
              events={selectedEvents}
              day={selectedDate}
              onOpen={(e) => setOpenId(e.id)}
              onSetColor={setEventColor}
              onSetAssignees={setEventAssignees}
              onDelete={requestDelete}
              profiles={listProfiles}
              selectedId={openId}
            />
          )}
        </section>
      )}
      </div>

      {/* Calendriers externes et partage : réglages rares, donc discrets */}
      <section aria-label="Calendriers externes et partage" className="flex flex-wrap items-center gap-2 pb-2">
        <SubscriptionChips subscriptions={subscriptions} onDelete={deleteSubscription} />
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => setSubDialogOpen(true)}
            className={iconBtn}
            title="Importer un calendrier externe"
            aria-label="Importer un calendrier externe"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <FeedExportButton placement="up" className={cn(iconBtn, "p-0")} />
          <Link href="/docs#calendrier" className={iconBtn} title="Documentation" aria-label="Documentation de l'agenda">
            <HelpCircle className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
