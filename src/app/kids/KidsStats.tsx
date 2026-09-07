"use client";

import { useMemo } from "react";
import {
  WEATHER_OPTIONS,
  MOOD_OPTIONS,
  ACTIVITY_OPTIONS,
  DryDay,
  AccidentDay,
  NapYes,
  NapNo,
} from "@/components/kids/icons";

interface DayEntry {
  date: string;
  weather: string | null;
  mood: string | null;
  nap: boolean | null;
  accident: boolean | null;
  activities: string[];
}

interface KidsStatsProps {
  entries: Record<string, DayEntry>;
  days: Date[];
  onClose: () => void;
}

export function KidsStats({ entries, days, onClose }: KidsStatsProps) {
  const stats = useMemo(() => {
    const filled = Object.values(entries).filter(
      (e) => e.weather || e.mood || e.nap != null || e.accident != null || e.activities.length > 0
    );
    const total = filled.length;

    const weatherCount: Record<string, number> = {};
    const moodCount: Record<string, number> = {};
    const activityCount: Record<string, number> = {};
    let napYes = 0, napNo = 0, dryDays = 0, accidentDays = 0;

    for (const e of filled) {
      if (e.weather) weatherCount[e.weather] = (weatherCount[e.weather] || 0) + 1;
      if (e.mood) moodCount[e.mood] = (moodCount[e.mood] || 0) + 1;
      if (e.nap === true) napYes++;
      if (e.nap === false) napNo++;
      if (e.accident === false) dryDays++;
      if (e.accident === true) accidentDays++;
      for (const a of e.activities) {
        activityCount[a] = (activityCount[a] || 0) + 1;
      }
    }

    const topWeather = Object.entries(weatherCount).sort((a, b) => b[1] - a[1]);
    const topMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1]);
    const topActivities = Object.entries(activityCount).sort((a, b) => b[1] - a[1]);

    return { total, topWeather, topMood, topActivities, napYes, napNo, dryDays, accidentDays };
  }, [entries]);

  return (
    <div className="kids-stats-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kids-stats">
        <div className="kids-stats-header">
          <h2 className="kids-stats-title">Récap de la semaine</h2>
          <button onClick={onClose} className="kids-editor-close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="kids-stats-body">
          {stats.total === 0 ? (
            <p className="kids-stats-empty">Aucune donnée pour cette semaine</p>
          ) : (
            <>
              {/* Filled days */}
              <div className="kids-stat-row">
                <span className="kids-stat-label">Jours remplis</span>
                <span className="kids-stat-value">{stats.total} / 7</span>
              </div>

              {/* Weather */}
              {stats.topWeather.length > 0 && (
                <section className="kids-stat-section">
                  <h3 className="kids-stat-section-title">Météo</h3>
                  <div className="kids-stat-icons">
                    {stats.topWeather.map(([id, count]) => {
                      const opt = WEATHER_OPTIONS.find((w) => w.id === id);
                      if (!opt) return null;
                      return (
                        <div key={id} className="kids-stat-icon-item">
                          <opt.Icon size={40} />
                          <span className="kids-stat-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Mood */}
              {stats.topMood.length > 0 && (
                <section className="kids-stat-section">
                  <h3 className="kids-stat-section-title">Humeur</h3>
                  <div className="kids-stat-icons">
                    {stats.topMood.map(([id, count]) => {
                      const opt = MOOD_OPTIONS.find((m) => m.id === id);
                      if (!opt) return null;
                      return (
                        <div key={id} className="kids-stat-icon-item">
                          <opt.Icon size={40} />
                          <span className="kids-stat-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Nap & Accidents */}
              {(stats.napYes + stats.napNo > 0 || stats.dryDays + stats.accidentDays > 0) && (
                <section className="kids-stat-section">
                  <h3 className="kids-stat-section-title">Sieste & Pipi</h3>
                  <div className="kids-stat-icons">
                    {stats.napYes > 0 && (
                      <div className="kids-stat-icon-item">
                        <NapYes size={40} />
                        <span className="kids-stat-count">{stats.napYes}</span>
                      </div>
                    )}
                    {stats.napNo > 0 && (
                      <div className="kids-stat-icon-item">
                        <NapNo size={40} />
                        <span className="kids-stat-count">{stats.napNo}</span>
                      </div>
                    )}
                    {stats.dryDays > 0 && (
                      <div className="kids-stat-icon-item">
                        <DryDay size={40} />
                        <span className="kids-stat-count">{stats.dryDays}</span>
                      </div>
                    )}
                    {stats.accidentDays > 0 && (
                      <div className="kids-stat-icon-item">
                        <AccidentDay size={40} />
                        <span className="kids-stat-count">{stats.accidentDays}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Activities */}
              {stats.topActivities.length > 0 && (
                <section className="kids-stat-section">
                  <h3 className="kids-stat-section-title">Activités</h3>
                  <div className="kids-stat-icons">
                    {stats.topActivities.map(([id, count]) => {
                      const opt = ACTIVITY_OPTIONS.find((a) => a.id === id);
                      if (!opt) return null;
                      return (
                        <div key={id} className="kids-stat-icon-item">
                          <opt.Icon size={40} />
                          <span className="kids-stat-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
