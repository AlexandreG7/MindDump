"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Rss,
  Check,
  Copy,
  RefreshCw,
  Link2Off,
  Link2,
  CalendarDays,
  Grid3X3,
  X,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  startOfYear,
  eachMonthOfInterval,
} from "date-fns";
import { fr } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endDate?: string | null;
  allDay: boolean;
  recurrence: string | null;
  notifyBefore: number | null;
  subscriptionId?: string;
  subscriptionName?: string;
  color?: string;
}

interface Subscription {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
}

type ViewMode = "month" | "year";

export default function CalendarPage() {
  const { isReady } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    allDay: false,
    recurrence: "",
    notifyBefore: "",
  });

  // Feed export state
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedCopied, setFeedCopied] = useState(false);
  const [feedMenuOpen, setFeedMenuOpen] = useState(false);

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [newSub, setNewSub] = useState({ name: "", url: "" });
  const [subLoading, setSubLoading] = useState(false);

  // Feed export functions
  useEffect(() => {
    if (isReady) {
      fetch("/api/calendar/feed")
        .then((r) => r.json())
        .then((data) => {
          if (data?.token) setFeedToken(data.token);
        });
    }
  }, [isReady]);

  const generateFeedToken = async () => {
    setFeedLoading(true);
    const res = await fetch("/api/calendar/feed", { method: "POST" });
    const data = await res.json();
    setFeedToken(data.token);
    setFeedLoading(false);
  };

  const revokeFeedToken = async () => {
    await fetch("/api/calendar/feed", { method: "DELETE" });
    setFeedToken(null);
    setFeedMenuOpen(false);
  };

  const getFeedUrl = () => {
    if (!feedToken) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/api/calendar/feed/${feedToken}`;
  };

  const getWebcalUrl = () =>
    getFeedUrl().replace(/^https?:\/\//, "webcal://");

  const copyFeedUrl = () => {
    navigator.clipboard.writeText(getFeedUrl());
    setFeedCopied(true);
    setTimeout(() => setFeedCopied(false), 2000);
  };

  const openInAppleCalendar = () => {
    window.open(getWebcalUrl(), "_self");
  };

  // Subscriptions functions
  const fetchSubscriptions = useCallback(() => {
    fetch("/api/calendar/subscriptions")
      .then((r) => r.json())
      .then((subs: Subscription[]) => {
        setSubscriptions(subs);
        subs.forEach((sub) => {
          if (sub.enabled) {
            fetch(`/api/calendar/subscriptions/${sub.id}`)
              .then((r) => r.json())
              .then((data) => {
                if (data.events) {
                  setExternalEvents((prev) => [
                    ...prev.filter((e) => e.subscriptionId !== sub.id),
                    ...data.events,
                  ]);
                }
              })
              .catch(() => {});
          }
        });
      });
  }, []);

  useEffect(() => {
    if (isReady) fetchSubscriptions();
  }, [isReady, fetchSubscriptions]);

  const addSubscription = async () => {
    if (!newSub.name.trim() || !newSub.url.trim()) return;
    setSubLoading(true);
    await fetch("/api/calendar/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSub.name, url: newSub.url }),
    });
    setNewSub({ name: "", url: "" });
    setSubDialogOpen(false);
    setSubLoading(false);
    fetchSubscriptions();
  };

  const deleteSubscription = async (id: string) => {
    await fetch(`/api/calendar/subscriptions/${id}`, { method: "DELETE" });
    setExternalEvents((prev) => prev.filter((e) => e.subscriptionId !== id));
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  };

  // Internal events
  const fetchEvents = useCallback(() => {
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    fetch(`/api/calendar?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then(setEvents);
  }, [currentMonth]);

  useEffect(() => {
    if (isReady) fetchEvents();
  }, [isReady, fetchEvents]);

  const addEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date) return;
    const dateStr = newEvent.time
      ? `${newEvent.date}T${newEvent.time}`
      : `${newEvent.date}T00:00:00`;

    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newEvent.title,
        description: newEvent.description || null,
        date: dateStr,
        allDay: !newEvent.time,
        recurrence: newEvent.recurrence || null,
        notifyBefore: newEvent.notifyBefore
          ? Number(newEvent.notifyBefore)
          : null,
      }),
    });
    setNewEvent({
      title: "",
      description: "",
      date: "",
      time: "",
      allDay: false,
      recurrence: "",
      notifyBefore: "",
    });
    setDialogOpen(false);
    fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    await fetch(`/api/calendar/${id}`, { method: "DELETE" });
    fetchEvents();
  };

  // All events merged
  const allEvents = useMemo(
    () => [...events, ...externalEvents],
    [events, externalEvents]
  );

  const getEventsForDate = useCallback(
    (date: Date) => allEvents.filter((e) => isSameDay(new Date(e.date), date)),
    [allEvents]
  );

  if (!isReady) return null;

  // Month view grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Year view data
  const yearStart = startOfYear(currentMonth);
  const months = eachMonthOfInterval({
    start: yearStart,
    end: new Date(currentMonth.getFullYear(), 11, 31),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-secondary rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("month")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "month"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vue mois"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("year")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "year"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vue année"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
          </div>

          {/* Subscribe external calendar */}
          <button
            onClick={() => setSubDialogOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            title="Importer un calendrier externe"
          >
            <Link2 className="h-4 w-4" />
          </button>

          {/* Feed export */}
          <div className="relative">
            <button
              onClick={() => {
                if (!feedToken) {
                  generateFeedToken();
                } else {
                  setFeedMenuOpen((v) => !v);
                }
              }}
              disabled={feedLoading}
              className={`p-2 rounded-lg transition-colors ${
                feedToken
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
              title={
                feedToken
                  ? "Exporter vers Apple Calendar"
                  : "Exporter vers Apple Calendar"
              }
            >
              <Rss className="h-4 w-4" />
            </button>
            {feedMenuOpen && feedToken && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFeedMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-popover border border-border rounded-xl shadow-lg p-4 space-y-3">
                  <p className="text-sm font-medium">Exporter le calendrier</p>
                  <p className="text-xs text-muted-foreground">
                    Exporte tes events MindDump vers Apple Calendar, Google
                    Calendar ou Outlook.
                  </p>
                  <button
                    onClick={() => {
                      openInAppleCalendar();
                      setFeedMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Rss className="h-3.5 w-3.5" />
                    Ouvrir dans Apple Calendar
                  </button>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={getFeedUrl()}
                      className="flex-1 text-xs bg-secondary/50 border border-border rounded-lg px-2 py-1.5 font-mono truncate"
                    />
                    <button
                      onClick={copyFeedUrl}
                      className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                        feedCopied
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-secondary text-muted-foreground"
                      }`}
                    >
                      {feedCopied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-border">
                    <button
                      onClick={() => generateFeedToken()}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Régénérer
                    </button>
                    <button
                      onClick={revokeFeedToken}
                      className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Link2Off className="h-3 w-3" />
                      Révoquer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* New event */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel evenement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un evenement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Titre</Label>
                  <Input
                    value={newEvent.title}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Description (optionnel)</Label>
                  <Textarea
                    value={newEvent.description}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Heure (optionnel)</Label>
                    <Input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, time: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Recurrence</Label>
                  <Select
                    value={newEvent.recurrence}
                    onValueChange={(v) =>
                      setNewEvent({ ...newEvent, recurrence: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      <SelectItem value="daily">Quotidien</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rappel email (minutes avant)</Label>
                  <Input
                    type="number"
                    value={newEvent.notifyBefore}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, notifyBefore: e.target.value })
                    }
                    placeholder="30"
                  />
                </div>
                <Button className="w-full" onClick={addEvent}>
                  Ajouter
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Subscription dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer un calendrier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dans Apple Calendar : clic droit sur un calendrier → Partager le
              calendrier → Calendrier public → copie l&apos;URL webcal://
            </p>
            <div>
              <Label>Nom</Label>
              <Input
                placeholder="Ex: Personnel, Boulot…"
                value={newSub.name}
                onChange={(e) =>
                  setNewSub({ ...newSub, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>URL du calendrier</Label>
              <Input
                placeholder="webcal://p12-caldav.icloud.com/…"
                value={newSub.url}
                onChange={(e) =>
                  setNewSub({ ...newSub, url: e.target.value })
                }
              />
            </div>
            <Button
              className="w-full"
              onClick={addSubscription}
              disabled={subLoading}
            >
              {subLoading ? "Importation…" : "Importer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscriptions list */}
      {subscriptions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-1.5 text-xs bg-secondary/50 rounded-full px-2.5 py-1"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: sub.color }}
              />
              <span>{sub.name}</span>
              <button
                onClick={() => deleteSubscription(sub.id)}
                className="p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setCurrentMonth(
              viewMode === "year"
                ? new Date(currentMonth.getFullYear() - 1, 0, 1)
                : subMonths(currentMonth, 1)
            )
          }
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {viewMode === "year"
            ? currentMonth.getFullYear().toString()
            : format(currentMonth, "MMMM yyyy", { locale: fr })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setCurrentMonth(
              viewMode === "year"
                ? new Date(currentMonth.getFullYear() + 1, 0, 1)
                : addMonths(currentMonth, 1)
            )
          }
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Month view */}
      {viewMode === "month" && (
        <>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div
                key={d}
                className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {days.map((d, i) => {
              const dayEvents = getEventsForDate(d);
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              return (
                <div
                  key={i}
                  className={`bg-background p-2 min-h-[80px] cursor-pointer transition-colors hover:bg-accent ${
                    !isSameMonth(d, currentMonth) ? "opacity-30" : ""
                  } ${isSelected ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedDate(d)}
                >
                  <span
                    className={`text-sm ${
                      isToday(d)
                        ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                        : ""
                    }`}
                  >
                    {format(d, "d")}
                  </span>
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className={`text-xs rounded px-1 mt-1 truncate ${
                        !e.color ? "bg-primary/10 text-primary" : ""
                      }`}
                      style={
                        e.color
                          ? {
                              backgroundColor: `${e.color}20`,
                              color: e.color,
                            }
                          : undefined
                      }
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      +{dayEvents.length - 2}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected date events */}
          {selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(selectedDate, "EEEE d MMMM", { locale: fr })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun evenement ce jour
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {selectedEvents.map((event) => (
                      <li
                        key={event.id}
                        className="flex items-start justify-between"
                      >
                        <div className="flex items-start gap-2">
                          {event.color && (
                            <div
                              className="w-1 h-full min-h-[20px] rounded-full mt-0.5"
                              style={{ backgroundColor: event.color }}
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium">{event.title}</p>
                            {event.subscriptionName && (
                              <p className="text-xs text-muted-foreground">
                                {event.subscriptionName}
                              </p>
                            )}
                            {event.description && (
                              <p className="text-xs text-muted-foreground">
                                {event.description}
                              </p>
                            )}
                            {!event.allDay && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(event.date), "HH:mm")}
                              </p>
                            )}
                          </div>
                        </div>
                        {!event.subscriptionId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteEvent(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Year view */}
      {viewMode === "year" && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
          {months.map((month) => {
            const mStart = startOfMonth(month);
            const mEnd = endOfMonth(month);
            const wStart = startOfWeek(mStart, { weekStartsOn: 1 });
            const wEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
            const mDays: Date[] = [];
            let d = wStart;
            while (d <= wEnd) {
              mDays.push(d);
              d = addDays(d, 1);
            }

            return (
              <div
                key={month.toISOString()}
                className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setCurrentMonth(month);
                  setViewMode("month");
                }}
              >
                <p className="text-sm font-semibold capitalize mb-2">
                  {format(month, "MMMM", { locale: fr })}
                </p>
                <div className="grid grid-cols-7 gap-px">
                  {["L", "M", "M", "J", "V", "S", "D"].map((dl, i) => (
                    <div
                      key={i}
                      className="text-center text-[9px] text-muted-foreground font-medium"
                    >
                      {dl}
                    </div>
                  ))}
                  {mDays.map((dd, i) => {
                    const hasEvents = getEventsForDate(dd).length > 0;
                    const inMonth = isSameMonth(dd, month);
                    return (
                      <div
                        key={i}
                        className={`text-center text-[10px] py-0.5 relative ${
                          !inMonth ? "text-transparent" : ""
                        } ${isToday(dd) ? "font-bold text-primary" : ""}`}
                      >
                        {format(dd, "d")}
                        {hasEvents && inMonth && (
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
