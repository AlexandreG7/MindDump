"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Maximize2, SlidersHorizontal } from "lucide-react";
import { KidIcon } from "@/components/kids/icons";
import { ProfileDialog, type ProfileDraft } from "@/components/profiles/ProfileDialog";
import { ProfileAvatar, textOn, type FamilyProfile } from "@/components/profiles/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useFeedback } from "@/components/ui/feedback";
import { HeroChip, HeroIconButton, ModuleHero } from "@/components/ui/module-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/ui/surface";
import { todayInParis } from "@/lib/kidWeek";
import { cn } from "@/lib/utils";
import { OutdatedBanner, RenameBanner } from "./Banners";
import { DaySheet } from "./DaySheet";
import { KidMode } from "./KidMode";
import { ViewEditor, type ViewEditorStart } from "./ViewEditor";
import { WeekTable, type WeekDay } from "./WeekTable";
import { KIDS_OUTDATED_EVENT, kidsFetch, plural } from "./kidsApi";
import { TRACKER_TEMPLATES } from "./templates";
import { useKidWeek } from "./useKidWeek";

const SELECTED_KEY = "kids:selectedProfile";
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const monday = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });

function RainbowIcon({ className }: { className?: string }) {
  return <KidIcon id="rainbow" size={40} decorative className={className} />;
}

export function KidsWeekly() {
  const { toast } = useFeedback();
  // « Aujourd'hui » (AAAA-MM-JJ, Paris) n'est connu qu'après le montage : le HTML serveur ne
  // contient aucune date, donc aucun écart d'hydratation. Relu au retour sur l'onglet et à minuit.
  const [today, setToday] = useState<string | null>(null);
  // Décalage en semaines par rapport à la semaine en cours : elle avance seule au passage de minuit.
  const [weekOffset, setWeekOffset] = useState(0);
  const [children, setChildren] = useState<FamilyProfile[] | null>(null);
  const [childrenError, setChildrenError] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [kidMode, setKidMode] = useState(false);
  const [dayEdit, setDayEdit] = useState<{ date: string; trackerId: string | null } | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewStart, setViewStart] = useState<ViewEditorStart>({ mode: "list" });
  const [renameOpen, setRenameOpen] = useState(false);
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    const refresh = () => setToday((cur) => {
      const now = todayInParis();
      return cur === now ? cur : now;
    });
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, []);

  const days: WeekDay[] = useMemo(() => {
    // Avant le montage : une semaine fictive, jamais lue ni affichée.
    const weekStart = addWeeks(monday(parseISO(today ?? "1970-01-05")), weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      return { date: iso(day), day, today: iso(day) === today };
    });
  }, [today, weekOffset]);
  const from = days[0].date;
  const to = days[6].date;
  const isCurrentWeek = weekOffset === 0;

  const { trackers, values, summary, status, reload, save } = useKidWeek(today ? profileId : null, from, to);

  useEffect(() => {
    const on = () => setOutdated(true);
    window.addEventListener(KIDS_OUTDATED_EVENT, on);
    return () => window.removeEventListener(KIDS_OUTDATED_EVENT, on);
  }, []);

  const loadChildren = useCallback(async () => {
    const res = await kidsFetch<FamilyProfile[]>("/api/profiles?kind=child");
    if (!res.ok || !res.data) {
      // Échec de lecture : ce n'est pas « pas d'enfant ». On le dit et on propose de réessayer.
      setChildrenError(true);
      return;
    }
    const list = res.data;
    setChildrenError(false);
    setChildren(list);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(SELECTED_KEY);
    } catch {}
    setProfileId((current) => list.find((c) => c.id === (current ?? saved))?.id ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const selectChild = (id: string) => {
    setProfileId(id);
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {}
  };

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

  /** Écrit une rubrique d'un jour. En mode enfant l'échec est dit dans la fenêtre du jour (les notifications passent derrière). */
  const setValue = useCallback(
    async (date: string, trackerId: string, next: string[] | number | null, notify = true) => {
      const ok = await save(date, { [trackerId]: next });
      if (!ok && notify) toast("L'enregistrement a échoué. Réessaie.", "error");
      return ok;
    },
    [save, toast]
  );

  const enterKidMode = () => {
    setWeekOffset(0);
    setDayEdit(null);
    setKidMode(true);
  };

  const child = children?.find((c) => c.id === profileId) ?? null;
  const sameNames = new Set(
    (children ?? []).filter((c, i, all) => all.findIndex((o) => o.name === c.name) !== i).map((c) => c.name)
  );
  const toRename = trackers.filter((t) => t.needsRename);
  const loading = status === "loading" && trackers.length === 0;
  const empty = status === "ready" && trackers.length === 0;

  const openViewEditor = (startWith: ViewEditorStart = { mode: "list" }) => {
    setViewStart(startWith);
    setViewOpen(true);
  };

  if (childrenError && !children) {
    return (
      <div className="mx-auto w-full max-w-3xl md:mx-0">
        <Surface className="p-6 text-center" role="alert">
          <p className="text-base font-bold">Les enfants ne se sont pas chargés.</p>
          <p className="mt-1 text-sm text-muted-foreground">Vérifie ta connexion, puis réessaie.</p>
          <Button variant="outline" className="mt-3 h-11 rounded-full px-5" onClick={() => void loadChildren()}>
            Réessayer
          </Button>
        </Surface>
      </div>
    );
  }

  if (children && children.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl md:mx-0">
        <Surface className="p-6">
          <EmptyState
            icon={RainbowIcon}
            tone="list"
            title="Ajoute d'abord ton enfant"
            action={
              <Button asChild className="h-12 rounded-full px-6 text-base">
                <Link href="/groups">Ajouter un enfant dans Groupes</Link>
              </Button>
            }
          >
            Les membres du groupe pourront remplir son semainier avec toi.
          </EmptyState>
        </Surface>
      </div>
    );
  }

  const rangeLabel = today ? `${format(days[0].day, "d MMM", { locale: fr })} – ${format(days[6].day, "d MMM yyyy", { locale: fr })}` : "\u00A0";
  const filledDays = summary?.filledDays ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 md:mx-0">
      {outdated && !kidMode && <OutdatedBanner />}

      <ModuleHero
        tone="list"
        kicker="Semainier"
        title={child?.name ?? "Semainier"}
        count={child && summary ? (empty ? trackers.length : filledDays) : null}
        countLabel={empty ? "rubrique" : plural(filledDays, "jour rempli", "jours remplis")}
        action={
          <>
            <HeroIconButton onClick={() => openViewEditor()} title="Modifier la vue" aria-label="Modifier la vue : rubriques et images" disabled={!child}>
              <SlidersHorizontal className="h-5 w-5" />
            </HeroIconButton>
            <HeroIconButton
              onClick={enterKidMode}
              title="Mode enfant"
              aria-label="Passer en mode enfant"
              disabled={!child}
              className="bg-on-tone text-tone-list hover:bg-on-tone/90"
            >
              <Maximize2 className="h-5 w-5" />
            </HeroIconButton>
          </>
        }
      >
        {summary && summary.countedDays > 0 && !empty && <HeroChip>sur {summary.countedDays} {plural(summary.countedDays, "jour écoulé", "jours écoulés")}</HeroChip>}
      </ModuleHero>

      {children && children.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Enfant">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectChild(c.id)}
              aria-pressed={c.id === profileId}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full border py-1 pl-1.5 pr-4 text-base transition-colors",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                c.id === profileId ? "border-transparent font-bold" : "border-border text-muted-foreground hover:bg-secondary"
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

      {toRename.length > 0 && (
        <RenameBanner
          names={toRename.map((t) => t.label)}
          onRename={() => openViewEditor({ mode: "edit", trackerId: toRename[0].id })}
        />
      )}

      {empty ? (
        <Surface className="px-4 py-6">
          <EmptyState
            icon={RainbowIcon}
            tone="list"
            title="Crée ta première rubrique"
            action={
              <Button onClick={() => openViewEditor({ mode: "create" })} className="h-12 rounded-full px-7 text-base">
                Créer une rubrique
              </Button>
            }
          >
            Tu choisis le nom et l&apos;image : ce que tu veux suivre pour {child?.name ?? "ton enfant"}, à ta façon.
          </EmptyState>
          <div className="mx-auto max-w-sm text-center">
            <p className="mb-2 text-sm font-bold text-muted-foreground">Ou pars d&apos;une idée</p>
            <div className="flex flex-wrap justify-center gap-2">
              {TRACKER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => openViewEditor({ mode: "create", template: tpl })}
                  className="flex h-11 items-center gap-2 rounded-full bg-secondary pl-2 pr-4 text-sm font-bold transition-colors hover:bg-secondary/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <KidIcon id={tpl.icon} size={28} decorative />
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
        </Surface>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              aria-label="Semaine précédente"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary transition-[transform,background-color] hover:bg-secondary/70 active:scale-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="min-w-0 text-center">
              <p className="text-lg font-extrabold leading-tight" aria-live="polite">{rangeLabel}</p>
              {isCurrentWeek ? (
                <p className="text-sm font-bold text-muted-foreground">Cette semaine</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="-my-1 min-h-11 rounded-full px-3 text-sm font-bold text-tone-list-ink underline underline-offset-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Revenir à cette semaine
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label="Semaine suivante"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary transition-[transform,background-color] hover:bg-secondary/70 active:scale-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {status === "error" ? (
            <Surface className="p-6 text-center" role="alert">
              <p className="text-base font-bold">La semaine ne s&apos;est pas chargée.</p>
              <Button variant="outline" className="mt-3 h-11 rounded-full px-5" onClick={() => reload()}>
                Réessayer
              </Button>
            </Surface>
          ) : loading || !child ? (
            <Surface className="space-y-3 p-4" aria-busy="true" aria-label="Chargement de la semaine">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ))}
            </Surface>
          ) : (
            <>
              <WeekTable
                trackers={trackers}
                days={days}
                values={values}
                onOpen={(date, trackerId) => setDayEdit({ date, trackerId: trackerId ?? null })}
              />
              {summary && summary.lines.length > 0 && (
                <Surface className="p-4 md:p-5" aria-labelledby="kid-summary">
                  <h2 id="kid-summary" className="mb-2 text-lg font-extrabold">
                    Bilan de la semaine
                  </h2>
                  <ul className="space-y-1.5 text-base">
                    {summary.lines.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-tone-list-ink" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </Surface>
              )}
            </>
          )}
        </>
      )}

      <DaySheet
        date={dayEdit?.date ?? null}
        focusTrackerId={dayEdit?.trackerId ?? null}
        weekFrom={from}
        weekTo={to}
        trackers={trackers}
        values={values}
        onChange={(date, trackerId, next) => void setValue(date, trackerId, next)}
        onDateChange={(date) => setDayEdit({ date, trackerId: null })}
        onClose={() => setDayEdit(null)}
      />

      {child && (
        <ViewEditor
          open={viewOpen}
          start={viewStart}
          profileId={child.id}
          childName={child.name}
          onClose={() => setViewOpen(false)}
          onChanged={() => reload(true)}
          onRenameChild={() => setRenameOpen(true)}
        />
      )}

      {kidMode && child && (
        <>
          {outdated && <OutdatedBanner className="fixed inset-x-4 top-4 z-10002 mx-auto max-w-xl" />}
          <KidMode
            childName={child.name}
            days={days}
            trackers={trackers}
            values={values}
            loading={status === "loading"}
            error={status === "error"}
            onRetry={() => reload()}
            rangeLabel={rangeLabel}
            onChange={(date, trackerId, next) => setValue(date, trackerId, next, false)}
            onExit={() => setKidMode(false)}
          />
        </>
      )}

      <ProfileDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        profile={child}
        defaultColor={child?.color ?? "#ec4899"}
        onSave={saveChild}
      />
    </div>
  );
}
