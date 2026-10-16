"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Hash, Info, ListChecks, CircleDot, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KID_LABEL_MAX, KID_MAX_ACTIVE_OPTIONS, type KidTrackerDto, type KidTrackerKind } from "@/lib/kidWeek";
import { cn } from "@/lib/utils";
import { IconPickerButton } from "./IconPicker";
import { kidsFetch } from "./kidsApi";
import { KIND_HINTS, KIND_LABELS, type TrackerTemplate } from "./templates";

interface OptionDraft {
  key: string;
  id?: string;
  label: string;
  icon: string;
  active: boolean;
  removed: boolean;
}

const KIND_ICONS: Record<KidTrackerKind, React.ComponentType<{ className?: string }>> = {
  single: CircleDot,
  multi: ListChecks,
  count: Hash,
};
const KINDS: KidTrackerKind[] = ["single", "multi", "count"];

/** Longueur en caractères (un émoji ou une lettre accentuée compte pour un). */
const len = (v: string) => Array.from(v.trim()).length;

let keySeq = 0;
const newKey = () => `o${++keySeq}`;
const blankOption = (): OptionDraft => ({ key: newKey(), label: "", icon: "star", active: true, removed: false });

function fromTracker(t: KidTrackerDto): OptionDraft[] {
  return [...t.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ key: newKey(), id: o.id, label: o.label, icon: o.icon, active: o.active, removed: false }));
}

/** Compteur de caractères : le libellé n'est jamais coupé en silence, l'enregistrement est refusé au-delà. */
function Counter({ value }: { value: string }) {
  const n = len(value);
  return (
    <span className={cn("text-xs tabular-nums", n > KID_LABEL_MAX ? "font-bold text-destructive" : "text-muted-foreground")}>
      {n}/{KID_LABEL_MAX}
    </span>
  );
}

const iconBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-70 transition-[opacity,background-color] hover:bg-secondary hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-25 disabled:hover:bg-transparent touch:opacity-100 touch:disabled:opacity-25";

/**
 * Création et modification d'une rubrique : nom, image, type (à la création seulement,
 * le type ne change plus ensuite) et choix. Le rappel « pas d'informations de santé »
 * reste visible en haut du formulaire.
 */
export function TrackerForm({
  profileId,
  tracker,
  template,
  activeCount,
  maxTrackers,
  onSaved,
  formId,
  onBusyChange,
}: {
  profileId: string;
  tracker?: KidTrackerDto;
  template?: TrackerTemplate;
  activeCount: number;
  maxTrackers: number;
  onSaved: (t: KidTrackerDto) => void;
  /** Identifiant du formulaire : le bouton « Enregistrer » est dans le pied de la feuille. */
  formId: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const editing = !!tracker;
  const uid = useId();
  const [label, setLabel] = useState(tracker?.label ?? template?.label ?? "");
  const [icon, setIcon] = useState<string>(tracker?.icon ?? template?.icon ?? "star");
  const [kind, setKind] = useState<KidTrackerKind>(tracker?.kind ?? template?.kind ?? "single");
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    tracker
      ? fromTracker(tracker)
      : template
        ? template.options.map((o) => ({ key: newKey(), label: o.label, icon: o.icon, active: true, removed: false }))
        : [blankOption(), blankOption()]
  );
  const [saving, setSaving] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const optionInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const labelInput = useRef<HTMLInputElement | null>(null);

  /** Met le focus sur le champ en erreur et l'amène à l'écran (au-dessus du clavier). */
  const focusField = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Après un tour de rendu : le clavier et le message d'erreur modifient la hauteur disponible.
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" }), 50);
  };

  const visible = options.filter((o) => !o.removed);
  const shown = visible.filter((o) => o.active);
  const hidden = visible.filter((o) => !o.active);
  const isCount = kind === "count";

  const patchOption = (key: string, patch: Partial<OptionDraft>) =>
    setOptions((all) => all.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const move = (key: string, dir: -1 | 1) =>
    setOptions((all) => {
      const act = all.filter((o) => o.active && !o.removed);
      const i = act.findIndex((o) => o.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= act.length) return all;
      const swapped = [...act];
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      let n = 0;
      return all.map((o) => (o.active && !o.removed ? swapped[n++] : o));
    });
  const remove = (o: OptionDraft) =>
    setOptions((all) => (o.id ? all.map((x) => (x.key === o.key ? { ...x, removed: true } : x)) : all.filter((x) => x.key !== o.key)));
  const addOption = () => {
    const o = blankOption();
    setOptions((all) => [...all, o]);
    setTimeout(() => optionInputs.current[o.key]?.focus(), 0);
  };

  const onRadioKey = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % 3 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i + 2) % 3 : null;
    if (to === null) return;
    e.preventDefault();
    setKind(KINDS[to]);
    radioRefs.current[to]?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setLabelError(null);
    setOptionsError(null);
    setFormError(null);

    const name = label.trim();
    const labelFail = (msg: string) => {
      setLabelError(msg);
      focusField(labelInput.current);
    };
    const optionsFail = (msg: string, target?: OptionDraft) => {
      setOptionsError(msg);
      focusField(target ? optionInputs.current[target.key] : null);
    };
    if (!name) return labelFail("Donne un nom à la rubrique.");
    if (len(name) > KID_LABEL_MAX) return labelFail(`${KID_LABEL_MAX} caractères au plus : raccourcis le nom.`);

    const filled = shown.filter((o) => o.label.trim() !== "");
    if (!isCount) {
      const unnamed = shown.find((o) => o.id && o.label.trim() === "");
      if (unnamed) return optionsFail("Un choix n'a plus de nom : nomme-le ou retire-le.", unnamed);
      if (filled.length === 0) return optionsFail("Ajoute au moins un choix.", shown.find((o) => o.label.trim() === ""));
      const tooLong = filled.find((o) => len(o.label) > KID_LABEL_MAX);
      if (tooLong) return optionsFail(`Un choix dépasse ${KID_LABEL_MAX} caractères : raccourcis-le.`, tooLong);
      if (filled.length > KID_MAX_ACTIVE_OPTIONS) return optionsFail(`${KID_MAX_ACTIVE_OPTIONS} choix au plus.`);
    }

    setSaving(true);
    onBusyChange(true);
    let res;
    if (!editing) {
      res = await kidsFetch<KidTrackerDto>("/api/kids/trackers", {
        method: "POST",
        json: {
          profileId,
          label: name,
          icon,
          kind,
          options: isCount ? [] : filled.map((o) => ({ label: o.label.trim(), icon: o.icon })),
        },
      });
    } else {
      const body: Record<string, unknown> = { label: name, icon };
      if (!isCount) {
        const list: Array<Record<string, unknown>> = [];
        for (const o of options) {
          if (o.removed) {
            if (o.id) list.push({ id: o.id, delete: true });
            continue;
          }
          if (!o.id) {
            if (o.active && o.label.trim()) list.push({ label: o.label.trim(), icon: o.icon });
            continue;
          }
          list.push({ id: o.id, label: o.label.trim(), icon: o.icon, active: o.active });
        }
        // L'ordre du tableau fixe l'ordre d'affichage : choix actifs d'abord, masqués ensuite.
        const rank = (x: Record<string, unknown>) => (x.delete ? 2 : x.active === false ? 1 : 0);
        body.options = list.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map((v) => v.x);
      }
      res = await kidsFetch<KidTrackerDto>(`/api/kids/trackers/${tracker.id}`, { method: "PATCH", json: body });
    }
    setSaving(false);
    onBusyChange(false);

    if (res.ok && res.data) return onSaved(res.data);
    const msg = res.error ?? "L'enregistrement a échoué.";
    if (res.code === "duplicate_label" && /rubrique/i.test(msg)) setLabelError(msg);
    else if (res.code === "duplicate_label" || res.code === "options_required" || res.code === "too_many_options") setOptionsError(msg);
    else if (res.code === "label_invalid" || res.code === "label_too_long") setLabelError(msg);
    else if (res.code !== "outdated_client") setFormError(msg);
  };

  const full = !editing && activeCount >= maxTrackers;

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      <p className="flex items-start gap-2.5 rounded-2xl bg-tone-todo-soft px-3.5 py-3 text-sm font-semibold text-tone-todo-ink">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          N&apos;y note pas d&apos;informations de santé.{" "}
          <a
            href="/cgu#donnees-de-sante"
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap underline underline-offset-2 hover:no-underline"
          >
            Voir les conditions
            <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
          </a>
        </span>
      </p>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor={`${uid}-label`} className="text-base font-extrabold">
            Nom de la rubrique
          </label>
          <Counter value={label} />
        </div>
        <Input
          ref={labelInput}
          id={`${uid}-label`}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setLabelError(null);
          }}
          placeholder="Par exemple : Météo, Humeur, Sorties"
          autoComplete="off"
          enterKeyHint="done"
          onKeyDown={(e) => {
            // Le bouton d'envoi est dans le pied de la feuille (hors du formulaire) : on relaie Entrée.
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          aria-invalid={!!labelError}
          aria-describedby={labelError ? `${uid}-label-err` : undefined}
          className={cn("h-12 rounded-xl text-base", labelError && "border-destructive")}
        />
        <p id={`${uid}-label-err`} aria-live="assertive" className={cn("text-sm font-semibold text-destructive", labelError && "mt-1.5")}>
          {labelError}
        </p>
        {tracker?.needsRename && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Cette rubrique vient de l&apos;ancien semainier. Choisis le nom que tu veux, ou enregistre pour garder celui-ci.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <IconPickerButton value={icon} onPick={setIcon} label="Image de la rubrique" size={60} />
        <div className="min-w-0">
          <p className="text-base font-extrabold">Image</p>
          <p className="text-sm text-muted-foreground">Touche l&apos;image pour la changer.</p>
        </div>
      </div>

      <div>
        <p id={`${uid}-kind`} className="mb-1.5 text-base font-extrabold">
          Type de réponse
        </p>
        {editing ? (
          <p className="rounded-2xl bg-secondary px-3.5 py-3 text-sm">
            <span className="font-bold">{KIND_LABELS[kind]}.</span> {KIND_HINTS[kind]}{" "}
            <span className="text-muted-foreground">Le type ne se change pas : crée une autre rubrique si besoin.</span>
          </p>
        ) : (
          <div role="radiogroup" aria-labelledby={`${uid}-kind`} className="grid gap-2">
            {KINDS.map((k, i) => {
              const Icon = KIND_ICONS[k];
              const on = k === kind;
              return (
                <button
                  key={k}
                  ref={(el) => {
                    radioRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setKind(k)}
                  onKeyDown={(e) => onRadioKey(e, i)}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition-colors",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-tone-list-ink bg-tone-list-soft" : "border-transparent bg-secondary hover:bg-secondary/70"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-base font-bold leading-tight">{KIND_LABELS[k]}</span>
                    <span className="block text-sm leading-snug text-muted-foreground">{KIND_HINTS[k]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isCount && (
        <fieldset>
          <legend className="mb-1.5 flex w-full items-baseline justify-between">
            <span className="text-base font-extrabold">Choix</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {shown.length}/{KID_MAX_ACTIVE_OPTIONS}
            </span>
          </legend>
          <ul className="space-y-2">
            {shown.map((o, i) => (
              <li key={o.key} className="flex items-center gap-1.5">
                <IconPickerButton value={o.icon} onPick={(id) => patchOption(o.key, { icon: id })} label={`Image du choix ${i + 1}`} size={44} />
                <Input
                  ref={(el) => {
                    optionInputs.current[o.key] = el;
                  }}
                  value={o.label}
                  onChange={(e) => {
                    patchOption(o.key, { label: e.target.value });
                    setOptionsError(null);
                  }}
                  aria-label={`Nom du choix ${i + 1}`}
                  aria-invalid={!!optionsError && (o.label.trim() === "" || len(o.label) > KID_LABEL_MAX)}
                  aria-describedby={optionsError ? `${uid}-opts-err` : undefined}
                  placeholder="Nom du choix"
                  autoComplete="off"
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  className={cn("h-12 min-w-0 flex-1 rounded-xl text-base", len(o.label) > KID_LABEL_MAX && "border-destructive")}
                />
                <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(o.key, -1)} aria-label={`Monter le choix ${i + 1}`}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={iconBtn} disabled={i === shown.length - 1} onClick={() => move(o.key, 1)} aria-label={`Descendre le choix ${i + 1}`}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={iconBtn} onClick={() => remove(o)} aria-label={`Retirer le choix ${i + 1}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {shown.length < KID_MAX_ACTIVE_OPTIONS && (
            <Button type="button" variant="secondary" onClick={addOption} className="mt-2 h-11 rounded-full px-4 text-sm">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Ajouter un choix
            </Button>
          )}
          {hidden.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-bold text-muted-foreground">Choix masqués (leurs anciennes saisies restent visibles)</p>
              <ul>
                {hidden.map((o) => (
                  <li key={o.key} className="flex items-center gap-2 text-muted-foreground">
                    <span className="min-w-0 flex-1 truncate text-sm">{o.label}</span>
                    <button
                      type="button"
                      className={iconBtn}
                      disabled={shown.length >= KID_MAX_ACTIVE_OPTIONS}
                      onClick={() => patchOption(o.key, { active: true })}
                      aria-label={`Réafficher le choix ${o.label}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p id={`${uid}-opts-err`} aria-live="assertive" className={cn("text-sm font-semibold text-destructive", optionsError && "mt-2")}>
            {optionsError}
          </p>
        </fieldset>
      )}

      {formError && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {formError}
        </p>
      )}
      {full && (
        <p role="status" className="text-sm text-muted-foreground">
          {maxTrackers} rubriques sont déjà affichées : masques-en une avant d&apos;en créer une autre.
        </p>
      )}
    </form>
  );
}
