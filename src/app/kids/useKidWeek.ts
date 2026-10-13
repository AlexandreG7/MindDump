"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KidDayValues, KidTrackerDto, KidWeekSummary } from "@/lib/kidWeek";
import { kidsFetch } from "./kidsApi";

interface WeekResponse {
  trackers: KidTrackerDto[];
  days: Array<{ date: string; values: KidDayValues }>;
  summary: KidWeekSummary;
}

export type DayPatch = Record<string, string[] | number | null>;

/**
 * Semaine d'un enfant : rubriques actives, saisies par jour et bilan.
 * Les saisies sont affichées tout de suite (optimiste) puis le bilan est relu
 * quand les écritures en cours sont terminées. La semaine est relue au retour
 * sur la page (saisies faites par l'assistant ou un autre membre du foyer).
 */
export function useKidWeek(profileId: string | null, from: string, to: string) {
  const [trackers, setTrackers] = useState<KidTrackerDto[]>([]);
  const [values, setValues] = useState<Record<string, KidDayValues>>({});
  const [summary, setSummary] = useState<KidWeekSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const token = useRef(0);
  const pending = useRef(0);
  const rangeKey = `${profileId}|${from}|${to}`;
  const lastKey = useRef(rangeKey);

  const load = useCallback(
    async (silent = false) => {
      if (!profileId) return;
      const mine = ++token.current;
      if (!silent) setStatus("loading");
      const res = await kidsFetch<WeekResponse>(`/api/kids/week?profileId=${profileId}&from=${from}&to=${to}`);
      if (mine !== token.current) return;
      if (!res.ok || !res.data) {
        if (!silent) setStatus("error");
        return;
      }
      setTrackers(res.data.trackers);
      setValues(Object.fromEntries(res.data.days.map((d) => [d.date, d.values])));
      setSummary(res.data.summary);
      setStatus("ready");
    },
    [profileId, from, to]
  );

  useEffect(() => {
    if (lastKey.current !== rangeKey) {
      lastKey.current = rangeKey;
      setValues({});
      setSummary(null);
    }
    load();
  }, [rangeKey, load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && pending.current === 0) load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  /** Écrit une partie d'un jour. Renvoie faux (et relit la semaine) si l'enregistrement échoue. */
  const save = useCallback(
    async (date: string, patch: DayPatch) => {
      if (!profileId) return false;
      setValues((prev) => {
        const day = { ...(prev[date] ?? {}) };
        for (const [id, v] of Object.entries(patch)) {
          if (v === null || (Array.isArray(v) && v.length === 0)) delete day[id];
          else day[id] = v;
        }
        return { ...prev, [date]: day };
      });
      pending.current++;
      const res = await kidsFetch(`/api/kids/day`, { method: "PATCH", json: { profileId, date, values: patch } });
      pending.current--;
      if (pending.current === 0) await load(true);
      return res.ok;
    },
    [profileId, load]
  );

  return { trackers, values, summary, status, reload: load, save };
}
