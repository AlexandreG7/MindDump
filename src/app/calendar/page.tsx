"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
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
} from "date-fns";
import { fr } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  allDay: boolean;
  recurrence: string | null;
  notifyBefore: number | null;
}

export default function CalendarPage() {
  const { status, isReady } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    allDay: false,
    recurrence: "",
    notifyBefore: "",
  });

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

  if (!isReady) return null;

  // Calendar grid
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

  const getEventsForDate = (date: Date) =>
    events.filter((e) => isSameDay(new Date(e.date), date));

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendrier</h1>
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

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar grid */}
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
                  className="text-xs bg-primary/10 text-primary rounded px-1 mt-1 truncate"
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
                    <div>
                      <p className="text-sm font-medium">{event.title}</p>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteEvent(event.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
