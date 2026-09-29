"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { addDays, addWeeks, startOfWeek, format, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, Maximize2, Lock, BarChart3, Pencil, Check } from "lucide-react";
import { ProfileDialog, type ProfileDraft } from "@/components/profiles/ProfileDialog";
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
import Link from "next/link";
import { ProfileAvatar, textOn, type FamilyProfile } from "@/components/profiles/ProfileAvatar";

const SELECTED_KEY = "kids:selectedProfile";

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

// Un double appui rapide d'enfant ne doit pas annuler l'activité qu'il vient de choisir.
const DOUBLE_TAP_MS = 450;

/**
 * Bouton de choix du semainier. Un appui sur un choix déjà pris ne l'annule
 * pas (les enfants tapent souvent deux fois) : on efface avec « Effacer ».
 */
function Choice({
  label,
  selected,
  onPick,
  large,
  showLabel,
  children,
}: {
  label: string;
  selected: boolean;
  onPick: () => void;
  large?: boolean;
  showLabel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={cn("kids-icon-btn", large && "kids-icon-lg", selected && "kids-icon-selected")}
    >
      {children}
      {showLabel && <span className="kids-icon-label">{label}</span>}
      {selected && (
        <span className="kids-icon-check" aria-hidden>
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function SectionHead({ label, canClear, onClear }: { label: string; canClear?: boolean; onClear?: () => void }) {
  return (
    <div className="kids-section-head">
      <p className="kids-section-label">{label}</p>
      {canClear && (
        <button type="button" onClick={onClear} className="kids-clear-btn" aria-label={`Effacer ${label.toLowerCase()}`}>
          Effacer
        </button>
      )}
    </div>
  );
}

export function KidsWeekly() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [children, setChildren] = useState<FamilyProfile[] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [exitProgress, setExitProgress] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastActivityTap = useRef<Record<string, number>>({});

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

  const [editOpen, setEditOpen] = useState(false);

  const loadChildren = useCallback(() => {
    fetch("/api/profiles?kind=child")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: FamilyProfile[]) => {
        setChildren(list);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(SELECTED_KEY);
        } catch {}
        setProfileId((current) => list.find((c) => c.id === (current ?? saved))?.id ?? list[0]?.id ?? null);
      })
      .catch(() => setChildren([]));
  }, []);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  // Renommer l'enfant (ex. « Mon enfant », créé à la reprise des anciens semainiers) sans passer par Groupes.
  const saveChild = async (draft: ProfileDraft) => {
    if (!profileId) return;
    const res = await fetch(`/api/profiles/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) throw new Error("Erreur");
    loadChildren();
  };

  const selectChild = (id: string) => {
    setProfileId(id);
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {}
  };

  const fetchWeek = useCallback(async () => {
    setEntries({});
    if (!profileId) return;
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addDays(weekStart, 6), "yyyy-MM-dd");
    try {
      const res = await fetch(`/api/kids?from=${from}&to=${to}&profileId=${profileId}`);
      if (res.ok) {
        const data = await res.json();
        const mapped: Record<string, DayEntry> = {};
        for (const e of data) mapped[e.date] = e;
        setEntries(mapped);
      }
    } catch {}
  }, [weekStart, profileId]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  const updateEntry = async (date: string, updates: Partial<DayEntry>) => {
    if (!profileId) return;
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

    const res = await fetch("/api/kids", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, profileId, ...updates }),
    }).catch(() => null);
    // En cas d'échec, on revient à l'état enregistré plutôt que d'afficher un choix perdu.
    if (!res?.ok) fetchWeek();
  };

  /** Choix unique : un nouvel appui sur la même réponse ne l'efface pas. */
  const pick = (date: string, field: "weather" | "mood" | "nap" | "accident", value: string | boolean) => {
    if (entries[date]?.[field] === value) return;
    updateEntry(date, { [field]: value });
  };

  const toggleActivity = (date: string, activityId: string) => {
    const now = Date.now();
    const key = `${date}:${activityId}`;
    if (now - (lastActivityTap.current[key] ?? 0) < DOUBLE_TAP_MS) return;
    lastActivityTap.current[key] = now;
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

  const child = children?.find((c) => c.id === profileId) ?? null;
  const sameNames = new Set(
    (children ?? []).filter((c, i, all) => all.findIndex((o) => o.name === c.name) !== i).map((c) => c.name)
  );

  if (children && children.length === 0) {
    return (
      <div className="kids-page">
        <div className="text-center py-16 space-y-3 max-w-sm mx-auto">
          <h1 className="kids-title">Semainier</h1>
          <p className="text-sm text-muted-foreground">
            Ajoute d&apos;abord ton enfant aux personnes de ton foyer. Les membres du groupe
            pourront remplir son semainier avec toi.
          </p>
          <Link href="/groups" className="inline-block text-sm font-medium text-primary hover:underline">
            Ajouter un enfant dans Groupes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("kids-page", fullscreen && "kids-fullscreen")}>
      {fullscreen && (
        <button
          className={cn("kids-fs-exit", exitProgress && "kids-fs-exit-active")}
          onPointerDown={startExit}
          onPointerUp={cancelExit}
          onPointerLeave={cancelExit}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Maintenir appuyé pour quitter le mode enfant"
          title="Maintenir appuyé pour quitter le mode enfant"
        >
          <Lock size={16} />
        </button>
      )}
      {/* Header */}
      <div className={cn("flex items-center mb-6", fullscreen ? "justify-center" : "justify-between")}>
        {/* En mode enfant, pas de changement de semaine : on remplit la semaine en cours. */}
        {!fullscreen && (
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            className="kids-nav-btn"
            aria-label="Semaine précédente"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="text-center">
          <h1 className="kids-title inline-flex items-center gap-2">
            {child ? `Semainier de ${child.name}` : "Semainier"}
            {child && !fullscreen && (
              <button
                onClick={() => setEditOpen(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Renommer"
                aria-label={`Renommer ${child.name}`}
              >
                <Pencil size={16} />
              </button>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(days[0], "d MMM", { locale: fr })} —{" "}
            {format(days[6], "d MMM yyyy", { locale: fr })}
          </p>
        </div>
        {!fullscreen && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowStats(true)}
              className="kids-fs-enter"
              title="Récap de la semaine"
              aria-label="Récap de la semaine"
            >
              <BarChart3 size={18} />
            </button>
            <button
              onClick={() => {
                setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                setFullscreen(true);
              }}
              className="kids-fs-enter"
              title="Mode enfant"
              aria-label="Passer en mode enfant"
            >
              <Maximize2 size={18} />
            </button>
            <button
              onClick={() => setWeekStart((w) => addWeeks(w, 1))}
              className="kids-nav-btn"
              aria-label="Semaine suivante"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
      </div>

      {!fullscreen && children && children.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 -mt-2 mb-5">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => selectChild(c.id)}
              className={cn(
                "flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-sm transition-colors",
                c.id === profileId
                  ? "border-transparent font-medium"
                  : "border-border text-muted-foreground hover:bg-secondary"
              )}
              style={c.id === profileId ? { backgroundColor: c.color, color: textOn(c.color) } : undefined}
            >
              <ProfileAvatar profile={c} size="sm" className={c.id === profileId ? "ring-2 ring-white/70" : undefined} />
              {c.name}
              {sameNames.has(c.name) && <span className="opacity-70">· {c.groupName}</span>}
            </button>
          ))}
        </div>
      )}

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
              aria-label={`${format(day, "EEEE d MMMM", { locale: fr })}${today ? ", aujourd'hui" : ""}${filled ? "" : ", à remplir"}`}
              className={cn("kids-day-card", today && "kids-day-today")}
              style={{
                backgroundColor: theme.bg,
                borderColor: today ? theme.color : "transparent",
                "--day-color": theme.color,
              } as React.CSSProperties}
            >
              <div
                className="kids-day-header"
                style={{ backgroundColor: theme.color, color: textOn(theme.color) }}
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
                    style={{ backgroundColor: theme.color, color: textOn(theme.color) }}
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
            // En mode enfant, toucher le fond ne ferme pas : un doigt qui déborde ne doit pas tout perdre.
            if (!fullscreen && e.target === e.currentTarget) setEditingDay(null);
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
                aria-label="Fermer"
              >
                <X size={22} color={textOn(editingTheme.color)} />
              </button>
              <h2 className="kids-editor-title" style={{ color: textOn(editingTheme.color) }}>
                {format(days[editingIndex], "EEEE d MMMM", { locale: fr })}
              </h2>
            </div>

            <div className="kids-editor-body">
              {/* Weather */}
              <section className="kids-section">
                <SectionHead
                  label="Météo"
                  canClear={!fullscreen && !!editingEntry?.weather}
                  onClear={() => updateEntry(editingDay, { weather: null })}
                />
                <div className="kids-section-row">
                  {WEATHER_OPTIONS.map((opt) => (
                    <Choice
                      key={opt.id}
                      label={opt.label}
                      selected={editingEntry?.weather === opt.id}
                      onPick={() => pick(editingDay, "weather", opt.id)}
                    >
                      <opt.Icon size={52} />
                    </Choice>
                  ))}
                </div>
              </section>

              {/* Mood */}
              <section className="kids-section">
                <SectionHead
                  label="Humeur"
                  canClear={!fullscreen && !!editingEntry?.mood}
                  onClear={() => updateEntry(editingDay, { mood: null })}
                />
                <div className="kids-section-row">
                  {MOOD_OPTIONS.map((opt) => (
                    <Choice
                      key={opt.id}
                      label={opt.label}
                      selected={editingEntry?.mood === opt.id}
                      onPick={() => pick(editingDay, "mood", opt.id)}
                    >
                      <opt.Icon size={52} />
                    </Choice>
                  ))}
                </div>
              </section>

              {/* Pipi */}
              <section className="kids-section">
                <SectionHead
                  label="Pipi"
                  canClear={!fullscreen && editingEntry?.accident != null}
                  onClear={() => updateEntry(editingDay, { accident: null })}
                />
                <div className="kids-section-row kids-section-binary">
                  <Choice
                    large
                    showLabel
                    label="Au sec"
                    selected={editingEntry?.accident === false}
                    onPick={() => pick(editingDay, "accident", false)}
                  >
                    <DryDay size={56} />
                  </Choice>
                  <Choice
                    large
                    showLabel
                    label="Accident"
                    selected={editingEntry?.accident === true}
                    onPick={() => pick(editingDay, "accident", true)}
                  >
                    <AccidentDay size={56} />
                  </Choice>
                </div>
              </section>

              {/* Nap */}
              <section className="kids-section">
                <SectionHead
                  label="Sieste"
                  canClear={!fullscreen && editingEntry?.nap != null}
                  onClear={() => updateEntry(editingDay, { nap: null })}
                />
                <div className="kids-section-row kids-section-binary">
                  <Choice
                    large
                    showLabel
                    label="Sieste"
                    selected={editingEntry?.nap === true}
                    onPick={() => pick(editingDay, "nap", true)}
                  >
                    <NapYes size={56} />
                  </Choice>
                  <Choice
                    large
                    showLabel
                    label="Pas de sieste"
                    selected={editingEntry?.nap === false}
                    onPick={() => pick(editingDay, "nap", false)}
                  >
                    <NapNo size={56} />
                  </Choice>
                </div>
              </section>

              {/* Activities */}
              <section className="kids-section">
                <SectionHead label="Activités" />
                <div className="kids-activity-grid">
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <Choice
                      key={opt.id}
                      label={opt.label}
                      selected={editingEntry?.activities?.includes(opt.id) ?? false}
                      onPick={() => toggleActivity(editingDay, opt.id)}
                    >
                      <opt.Icon size={48} />
                    </Choice>
                  ))}
                </div>
              </section>
            </div>

            <div className="kids-editor-footer">
              <button
                onClick={() => setEditingDay(null)}
                className="kids-done-btn"
                style={{ backgroundColor: editingTheme.color, color: textOn(editingTheme.color) }}
              >
                Fini !
              </button>
            </div>
          </div>
        </div>
      )}

      {showStats && (
        <KidsStats entries={entries} days={days} onClose={() => setShowStats(false)} />
      )}

      <ProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={child}
        defaultColor={child?.color ?? "#ec4899"}
        onSave={saveChild}
      />
    </div>
  );
}
