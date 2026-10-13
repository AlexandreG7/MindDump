"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KidDayValues, KidTrackerDto, KidWeekSummary } from "@/lib/kidWeek";
import { kidsFetch } from "./kidsApi";

interface WeekResponse {
  trackers: KidTrackerDto[];
  days: Array<{ date: string; values: KidDayValues }>;
  summary: KidWeekSummary;
}

const EMPTY_TRACKERS: KidTrackerDto[] = [];

export type DayPatch = Record<string, string[] | number | null>;

/**
 * Semaine d'un enfant : rubriques actives, saisies par jour et bilan.
 * Les saisies sont affichées tout de suite (optimiste) puis le bilan est relu
 * quand les écritures en cours sont terminées. La semaine est relue au retour
 * sur la page (saisies faites par l'assistant ou un autre membre du foyer).
 */
export function useKidWeek(profileId: string | null, from: string, to: string) {
  const [rawTrackers, setTrackers] = useState<KidTrackerDto[]>([]);
  const [values, setValues] = useState<Record<string, KidDayValues>>({});
  const [summary, setSummary] = useState<KidWeekSummary | null>(null);
  // Enfant dont viennent les rubriques affichées : tant qu'il diffère de l'enfant choisi,
  // on n'affiche rien de lui (ni rubriques, ni bandeau « à renommer »).
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const trackers = loadedProfileId === profileId ? rawTrackers : EMPTY_TRACKERS;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const token = useRef(0);
  const pending = useRef(0);
  // File d'écritures par enfant et par jour : deux appuis rapides partent l'un après l'autre,
  // dans l'ordre, et le serveur ne peut pas appliquer le plus ancien en dernier.
  const queues = useRef(new Map<string, Promise<unknown>>());
  const rangeKey = `${profileId}|${from}|${to}`;
  const lastKey = useRef(rangeKey);
  const lastProfile = useRef(profileId);

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
      setLoadedProfileId(profileId);
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
      if (lastProfile.current !== profileId) {
        lastProfile.current = profileId;
        setTrackers(EMPTY_TRACKERS);
        setLoadedProfileId(null);
        setStatus("loading");
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const key = `${profileId}|${date}`;
      const run = (queues.current.get(key) ?? Promise.resolve()).then(() =>
        kidsFetch(`/api/kids/day`, { method: "PATCH", json: { profileId, date, values: patch } })
      );
      queues.current.set(key, run);
      const res = await run;
      if (queues.current.get(key) === run) queues.current.delete(key);
      pending.current--;
      if (pending.current === 0) await load(true);
      return res.ok;
    },
    [profileId, load]
  );

  // Entre le choix d'un autre enfant et l'arrivée de ses rubriques : chargement, jamais « vide ».
  const effectiveStatus = status === "ready" && profileId !== loadedProfileId ? "loading" : status;
  return { trackers, values, summary, status: effectiveStatus, reload: load, save };
}
