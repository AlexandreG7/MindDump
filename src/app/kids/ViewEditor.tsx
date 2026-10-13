"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { KID_MAX_ACTIVE_TRACKERS, type KidTrackerDto } from "@/lib/kidWeek";
import { cn } from "@/lib/utils";
import { TrackerIcon } from "./DayForm";
import { KidsSheet } from "./KidsSheet";
import { TrackerForm } from "./TrackerForm";
import { kidsFetch } from "./kidsApi";
import { KIND_LABELS, TRACKER_TEMPLATES, type TrackerTemplate } from "./templates";

type Screen = { name: "list" } | { name: "form"; tracker?: KidTrackerDto; template?: TrackerTemplate };

export type ViewEditorStart = { mode: "list" } | { mode: "create"; template?: TrackerTemplate } | { mode: "edit"; trackerId: string };

const rowBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-70 transition-[opacity,background-color] hover:bg-secondary hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-25 disabled:hover:bg-transparent touch:opacity-100 touch:disabled:opacity-25";

/**
 * Éditeur de vue : la liste des rubriques de l'enfant (créer, renommer, réordonner,
 * masquer, supprimer) et, par-dessus, le formulaire d'une rubrique. Une rubrique qui
 * a des saisies n'est jamais supprimée : on la masque (réversible).
 */
export function ViewEditor({
  open,
  start,
  profileId,
  childName,
  onClose,
  onChanged,
  onRenameChild,
}: {
  open: boolean;
  start: ViewEditorStart;
  profileId: string;
  childName: string;
  onClose: () => void;
  /** La vue a changé : la semaine doit être relue. */
  onChanged: () => void;
  onRenameChild: () => void;
}) {
  const { confirm, toast } = useFeedback();
  const [all, setAll] = useState<KidTrackerDto[] | null>(null);
  const [error, setError] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: "list" });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await kidsFetch<KidTrackerDto[]>(`/api/kids/trackers?profileId=${profileId}&all=1`);
    if (res.ok && res.data) {
      setAll(res.data);
      setError(false);
      return res.data;
    }
    setError(true);
    return null;
  }, [profileId]);

  useEffect(() => {
    if (!open) return;
    setAll(null);
    setScreen({ name: "list" });
    refresh().then((list) => {
      if (!list) return;
      if (start.mode === "create") setScreen({ name: "form", template: start.template });
      else if (start.mode === "edit") {
        const t = list.find((x) => x.id === start.trackerId);
        if (t) setScreen({ name: "form", tracker: t });
      }
    });
    // `start` est lu à l'ouverture seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profileId]);

  const active = (all ?? []).filter((t) => t.active);
  const hiddenOnes = (all ?? []).filter((t) => !t.active);
  const full = active.length >= KID_MAX_ACTIVE_TRACKERS;

  const patch = async (t: KidTrackerDto, json: Record<string, unknown>) => {
    setBusy(true);
    const res = await kidsFetch(`/api/kids/trackers/${t.id}`, { method: "PATCH", json });
    setBusy(false);
    if (!res.ok) {
      if (res.code !== "outdated_client") toast(res.error ?? "Modification impossible.", "error");
      return false;
    }
    await refresh();
    onChanged();
    return true;
  };

  const hide = async (t: KidTrackerDto) => {
    if (await patch(t, { active: false })) {
      toast(`« ${t.label} » est masquée. Ses saisies sont conservées.`, "success", {
        label: "Annuler",
        onClick: () => void patch(t, { active: true }),
      });
    }
  };

  const show = async (t: KidTrackerDto) => {
    if (await patch(t, { active: true })) toast(`« ${t.label} » est de nouveau affichée.`, "success");
  };

  const move = async (t: KidTrackerDto, dir: -1 | 1) => {
    const ids = active.map((x) => x.id);
    const i = ids.indexOf(t.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    // Affichage immédiat, puis relecture : l'ordre du serveur fait foi.
    setAll((cur) => {
      if (!cur) return cur;
      const byId = new Map(cur.map((x) => [x.id, x]));
      return [...ids.map((id) => byId.get(id)!), ...cur.filter((x) => !ids.includes(x.id))];
    });
    const res = await kidsFetch(`/api/kids/trackers/order`, { method: "PUT", json: { profileId, ids } });
    if (!res.ok && res.code !== "outdated_client") toast(res.error ?? "L'ordre n'a pas été enregistré.", "error");
    await refresh();
    onChanged();
  };

  const remove = async (t: KidTrackerDto) => {
    const ok = await confirm({
      title: `Supprimer « ${t.label} » ?`,
      description: "La rubrique disparaît pour de bon si elle n'a aucune saisie. Sinon, on te proposera de la masquer.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await kidsFetch(`/api/kids/trackers/${t.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      toast(`« ${t.label} » est supprimée.`, "success");
      await refresh();
      onChanged();
      return;
    }
    if (res.status === 409 && res.code === "has_entries") {
      const hideIt = await confirm({
        title: "Elle a des saisies : on la masque ?",
        description: `« ${t.label} » ne peut pas être supprimée, ses saisies sont conservées. Masquée, elle disparaît de la semaine et tu peux la réafficher à tout moment.`,
        confirmLabel: "Masquer",
      });
      if (hideIt) await hide(t);
      return;
    }
    if (res.code !== "outdated_client") toast(res.error ?? "Suppression impossible.", "error");
  };

  const inForm = screen.name === "form";
  const title = inForm ? (screen.tracker ? "Modifier la rubrique" : "Nouvelle rubrique") : `Vue de ${childName}`;

  return (
    <KidsSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description="Choisis les rubriques que tu suis pour cet enfant, leur image, leurs choix et leur ordre."
      footer={
        inForm ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setScreen({ name: "list" })} className="h-12 flex-1 rounded-full text-base">
              Annuler
            </Button>
            <Button
              type="submit"
              form="kid-tracker-form"
              disabled={saving || (!screen.tracker && full)}
              className="h-12 flex-[1.5] rounded-full text-base"
            >
              {saving ? "Enregistrement…" : screen.tracker ? "Enregistrer" : "Créer la rubrique"}
            </Button>
          </div>
        ) : undefined
      }
      headerLeading={
        inForm ? (
          <button
            type="button"
            onClick={() => setScreen({ name: "list" })}
            aria-label="Retour à la liste des rubriques"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : undefined
      }
      headerTrailing={
        !inForm ? (
          <button
            type="button"
            onClick={onRenameChild}
            aria-label={`Renommer ${childName}`}
            title={`Renommer ${childName}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-70 transition-[opacity,background-color] hover:bg-secondary hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : undefined
      }
    >
      {inForm ? (
        <TrackerForm
          key={screen.tracker?.id ?? screen.template?.id ?? "new"}
          profileId={profileId}
          tracker={screen.tracker}
          template={screen.template}
          activeCount={active.length}
          maxTrackers={KID_MAX_ACTIVE_TRACKERS}
          formId="kid-tracker-form"
          onBusyChange={setSaving}
          onSaved={async (saved) => {
            toast(screen.tracker ? "Rubrique enregistrée." : `« ${saved.label} » est créée.`, "success");
            await refresh();
            onChanged();
            setScreen({ name: "list" });
          }}
        />
      ) : all === null ? (
        <p role={error ? "alert" : "status"} className="py-10 text-center text-muted-foreground">
          {error ? (
            <>
              Impossible de charger les rubriques.{" "}
              <button type="button" onClick={refresh} className="font-bold text-foreground underline underline-offset-2">
                Réessayer
              </button>
            </>
          ) : (
            "Chargement…"
          )}
        </p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Tu choisis ce que tu notes. Une rubrique qui a des saisies se masque au lieu de se supprimer.
          </p>

          {active.length === 0 && (
            <div className="rounded-2xl bg-secondary px-4 py-5 text-center">
              <p className="text-base font-extrabold">Aucune rubrique pour l&apos;instant</p>
              <p className="mt-1 text-sm text-muted-foreground">Crée la première avec ton propre nom et une image.</p>
            </div>
          )}

          <ul className="space-y-2" aria-label="Rubriques affichées">
            {active.map((t, i) => (
              <li key={t.id} className="group/card rounded-2xl bg-secondary/70 p-2 md:flex md:items-center md:gap-1">
                <button
                  type="button"
                  onClick={() => setScreen({ name: "form", tracker: t })}
                  aria-label={`Modifier ${t.label}`}
                  className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex-1"
                >
                  <TrackerIcon id={t.icon} size={36} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-extrabold leading-tight">{t.label}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {KIND_LABELS[t.kind]}
                      {t.kind !== "count" && ` · ${t.options.filter((o) => o.active).length} choix`}
                    </span>
                  </span>
                  {t.needsRename && (
                    <span className="shrink-0 rounded-full bg-tone-todo-soft px-2.5 py-1 text-xs font-extrabold text-tone-todo-ink">À renommer</span>
                  )}
                </button>
                <div className="-mt-1 flex justify-end md:mt-0 md:shrink-0">
                  <button type="button" className={rowBtn} disabled={busy || i === 0} onClick={() => move(t, -1)} aria-label={`Monter ${t.label}`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={rowBtn} disabled={busy || i === active.length - 1} onClick={() => move(t, 1)} aria-label={`Descendre ${t.label}`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={rowBtn} disabled={busy} onClick={() => hide(t)} aria-label={`Masquer ${t.label}`} title="Masquer">
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={rowBtn} disabled={busy} onClick={() => remove(t)} aria-label={`Supprimer ${t.label}`} title="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div>
            <Button onClick={() => setScreen({ name: "form" })} disabled={full} className="h-12 w-full rounded-full text-base">
              <Plus className="mr-2 h-5 w-5" aria-hidden />
              Ajouter une rubrique
            </Button>
            {full && (
              <p role="status" className="mt-2 text-center text-sm text-muted-foreground">
                {KID_MAX_ACTIVE_TRACKERS} rubriques affichées au plus : masques-en une pour en ajouter.
              </p>
            )}
          </div>

          {!full && active.length < 3 && (
            <div>
              <p className="mb-2 text-sm font-bold text-muted-foreground">Ou pars d&apos;une idée</p>
              <div className="flex flex-wrap gap-2">
                {TRACKER_TEMPLATES.filter((tpl) => !(all ?? []).some((t) => t.label.toLowerCase() === tpl.label.toLowerCase())).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setScreen({ name: "form", template: tpl })}
                    className="flex h-11 items-center gap-2 rounded-full bg-secondary pl-2 pr-4 text-sm font-bold transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TrackerIcon id={tpl.icon} size={28} />
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hiddenOnes.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-base font-extrabold text-muted-foreground">Masquées</h3>
              <ul className="space-y-1.5" aria-label="Rubriques masquées">
                {hiddenOnes.map((t) => (
                  <li key={t.id} className={cn("group/card flex items-center gap-2 rounded-2xl border border-dashed border-muted-foreground/30 p-2 pl-3")}>
                    <TrackerIcon id={t.icon} size={28} className="shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate text-base font-bold text-muted-foreground">{t.label}</span>
                    <button type="button" className={rowBtn} disabled={busy} onClick={() => show(t)} aria-label={`Réafficher ${t.label}`} title="Réafficher">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className={rowBtn} disabled={busy} onClick={() => remove(t)} aria-label={`Supprimer ${t.label}`} title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </KidsSheet>
  );
}
