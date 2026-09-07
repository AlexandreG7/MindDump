"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { addDays, addWeeks, startOfWeek, format, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, Maximize2, Lock, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NapYes,
  NapNo,
  DryDay,
  AccidentDay,
  WEATHER_OPTIONS,
  MOOD_OPTIONS,
  ACTIVITY_OPTIONS,
} from "@/components/kids/icons";
import { KidsStats } from "./KidsStats";

interface DayEntry {
  date: string;
  weather: string | null;
  mood: string | null;
  nap: boolean | null;
  accident: boolean | null;
  activities: string[];
}

const DAY_THEMES = [
  { color: "#FF6B6B", bg: "#FFF0F0" },
  { color: "#FF9F43", bg: "#FFF5EC" },
  { color: "#FECA57", bg: "#FFFBEB" },
  { color: "#48C774", bg: "#EDFFF4" },
  { color: "#54A0FF", bg: "#EEF5FF" },
  { color: "#A29BFE", bg: "#F3F1FF" },
  { color: "#FF6B9D", bg: "#FFF0F5" },
];

export function KidsWeekly() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [exitProgress, setExitProgress] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();

  const startExit = () => {
    setExitProgress(true);
    exitTimer.current = setTimeout(() => {
      setFullscreen(false);
      setExitProgress(false);
    }, 1000);
  };

  const cancelExit = () => {
    clearTimeout(exitTimer.current);
    setExitProgress(false);
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchWeek = useCallback(async () => {
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addDays(weekStart, 6), "yyyy-MM-dd");
    try {
      const res = await fetch(`/api/kids?from=${from}&to=${to}`);
      if (res.ok) {
        const data = await res.json();
        const mapped: Record<string, DayEntry> = {};
        for (const e of data) mapped[e.date] = e;
        setEntries(mapped);
      }
    } catch {}
  }, [weekStart]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  const updateEntry = async (date: string, updates: Partial<DayEntry>) => {
    setEntries((prev) => {
      const existing = prev[date] || {
        date,
        weather: null,
        mood: null,
        nap: null,
        accident: null,
        activities: [],
      };
      return { ...prev, [date]: { ...existing, ...updates } };
    });

    await fetch("/api/kids", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, ...updates }),
    });
  };

  const toggleActivity = (date: string, activityId: string) => {
    const current = entries[date]?.activities || [];
    const next = current.includes(activityId)
      ? current.filter((a) => a !== activityId)
      : [...current, activityId];
    updateEntry(date, { activities: next });
  };

  const editingIndex = editingDay
    ? days.findIndex((d) => format(d, "yyyy-MM-dd") === editingDay)
    : -1;
  const editingTheme = editingIndex >= 0 ? DAY_THEMES[editingIndex] : null;
  const editingEntry = editingDay ? entries[editingDay] || null : null;

  return (
    <div className={cn("kids-page", fullscreen && "kids-fullscreen")}>
      {fullscreen && (
        <button
          className={cn("kids-fs-exit", exitProgress && "kids-fs-exit-active")}
          onPointerDown={startExit}
          onPointerUp={cancelExit}
          onPointerLeave={cancelExit}
        >
          <Lock size={14} />
        </button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          className="kids-nav-btn"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <h1 className="kids-title">Mon Semainier</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(days[0], "d MMM", { locale: fr })} —{" "}
            {format(days[6], "d MMM yyyy", { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!fullscreen && (
            <>
              <button
                onClick={() => setShowStats(true)}
                className="kids-fs-enter"
                title="Récap semaine"
              >
                <BarChart3 size={18} />
              </button>
              <button
                onClick={() => setFullscreen(true)}
                className="kids-fs-enter"
                title="Mode enfant"
              >
                <Maximize2 size={18} />
              </button>
            </>
          )}
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="kids-nav-btn"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="kids-week-grid">
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const entry = entries[dateStr];
          const theme = DAY_THEMES[i];
          const today = isToday(day);

          const weatherOpt = WEATHER_OPTIONS.find(
            (w) => w.id === entry?.weather
          );
          const moodOpt = MOOD_OPTIONS.find((m) => m.id === entry?.mood);
          const actCount = entry?.activities?.length || 0;
          const filled =
            !!entry?.weather ||
            !!entry?.mood ||
            entry?.nap != null ||
            entry?.accident != null ||
            actCount > 0;

          return (
            <button
              key={dateStr}
              onClick={() => setEditingDay(dateStr)}
              className={cn("kids-day-card", today && "kids-day-today")}
              style={{
                backgroundColor: theme.bg,
                borderColor: today ? theme.color : "transparent",
              }}
            >
              <div
                className="kids-day-header"
                style={{ backgroundColor: theme.color }}
              >
                <span className="kids-day-name">
                  {format(day, "EEE", { locale: fr })}
                </span>
                <span className="kids-day-number">{format(day, "d")}</span>
              </div>
              <div className="kids-day-preview">
                {weatherOpt && <weatherOpt.Icon size={28} />}
                {moodOpt && <moodOpt.Icon size={28} />}
                {entry?.nap === true && <NapYes size={24} />}
                {entry?.accident === true && <AccidentDay size={24} />}
                {actCount > 0 && (
                  <span
                    className="kids-activity-badge"
                    style={{ backgroundColor: theme.color }}
                  >
                    {actCount}
                  </span>
                )}
                {!filled && (
                  <span className="kids-day-empty" style={{ color: theme.color }}>
                    +
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day editor overlay */}
      {editingDay && editingTheme && (
        <div
          className="kids-editor-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingDay(null);
          }}
        >
          <div className="kids-editor">
            <div
              className="kids-editor-header"
              style={{ backgroundColor: editingTheme.color }}
            >
              <button
                onClick={() => setEditingDay(null)}
                className="kids-editor-close"
              >
                <X size={22} color="white" />
              </button>
              <h2 className="kids-editor-title">
                {format(days[editingIndex], "EEEE d MMMM", { locale: fr })}
              </h2>
            </div>

            <div className="kids-editor-body">
              {/* Weather */}
              <section className="kids-section">
                <p className="kids-section-label">Météo</p>
                <div className="kids-section-row">
                  {WEATHER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        updateEntry(editingDay, {
                          weather:
                            editingEntry?.weather === opt.id ? null : opt.id,
                        })
                      }
                      className={cn(
                        "kids-icon-btn",
                        editingEntry?.weather === opt.id && "kids-icon-selected"
                      )}
                    >
                      <opt.Icon size={52} />
                    </button>
                  ))}
                </div>
              </section>

              {/* Mood */}
              <section className="kids-section">
                <p className="kids-section-label">Humeur</p>
                <div className="kids-section-row">
                  {MOOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        updateEntry(editingDay, {
                          mood:
                            editingEntry?.mood === opt.id ? null : opt.id,
                        })
                      }
                      className={cn(
                        "kids-icon-btn",
                        editingEntry?.mood === opt.id && "kids-icon-selected"
                      )}
                    >
                      <opt.Icon size={52} />
                    </button>
                  ))}
                </div>
              </section>

              {/* Pipi */}
              <section className="kids-section">
                <p className="kids-section-label">Pipi</p>
                <div className="kids-section-row kids-section-binary">
                  <button
                    onClick={() =>
                      updateEntry(editingDay, {
                        accident:
                          editingEntry?.accident === false ? null : false,
                      })
                    }
                    className={cn(
                      "kids-icon-btn kids-icon-lg",
                      editingEntry?.accident === false && "kids-icon-selected"
                    )}
                  >
                    <DryDay size={56} />
                  </button>
                  <button
                    onClick={() =>
                      updateEntry(editingDay, {
                        accident:
                          editingEntry?.accident === true ? null : true,
                      })
                    }
                    className={cn(
                      "kids-icon-btn kids-icon-lg",
                      editingEntry?.accident === true && "kids-icon-selected"
                    )}
                  >
                    <AccidentDay size={56} />
                  </button>
                </div>
              </section>

              {/* Nap */}
              <section className="kids-section">
                <p className="kids-section-label">Sieste</p>
                <div className="kids-section-row kids-section-binary">
                  <button
                    onClick={() =>
                      updateEntry(editingDay, {
                        nap: editingEntry?.nap === true ? null : true,
                      })
                    }
                    className={cn(
                      "kids-icon-btn kids-icon-lg",
                      editingEntry?.nap === true && "kids-icon-selected"
                    )}
                  >
                    <NapYes size={56} />
                  </button>
                  <button
                    onClick={() =>
                      updateEntry(editingDay, {
                        nap: editingEntry?.nap === false ? null : false,
                      })
                    }
                    className={cn(
                      "kids-icon-btn kids-icon-lg",
                      editingEntry?.nap === false && "kids-icon-selected"
                    )}
                  >
                    <NapNo size={56} />
                  </button>
                </div>
              </section>

              {/* Activities */}
              <section className="kids-section">
                <p className="kids-section-label">Activités</p>
                <div className="kids-activity-grid">
                  {ACTIVITY_OPTIONS.map((opt) => {
                    const sel =
                      editingEntry?.activities?.includes(opt.id) ?? false;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleActivity(editingDay!, opt.id)}
                        className={cn(
                          "kids-icon-btn",
                          sel && "kids-icon-selected"
                        )}
                      >
                        <opt.Icon size={48} />
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {showStats && (
        <KidsStats entries={entries} days={days} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}
