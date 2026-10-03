"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, CheckSquare, FileText, ImageIcon, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { AssigneePicker } from "@/components/profiles/Assignees";
import type { FamilyProfile } from "@/components/profiles/ProfileAvatar";
import { RECURRENCE_LABELS } from "@/lib/recurrence";
import type { ProposedEvent, ProposedTodo } from "@/lib/ai/importPlanning";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/image";

export interface AiImportStatus {
  enabled: boolean;
  limit: number;
  remaining: number;
}

/** État de l'import IA (activé sur le serveur, imports restants), ou null tant qu'il est inconnu. */
export function useAiImportStatus() {
  const [status, setStatus] = useState<AiImportStatus | null>(null);
  useEffect(() => {
    fetch("/api/import/ai")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
  }, []);
  return [status, setStatus] as const;
}

type Row<T> = T & { key: number; selected: boolean };

function localToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function dayLabel(day: string): string {
  try {
    return format(parseISO(day), "EEE d MMM", { locale: fr });
  } catch {
    return day;
  }
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Import IA : une photo, un PDF ou un texte → des événements et des tâches
 * proposés, que l'on relit et corrige avant de les ajouter.
 */
export function AiImportDialog({
  open,
  onOpenChange,
  groupId,
  profiles,
  status,
  onStatusChange,
  onImported,
  initialFile = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | null;
  profiles: FamilyProfile[];
  status: AiImportStatus | null;
  onStatusChange: (status: AiImportStatus) => void;
  onImported: () => void;
  /** Fichier déjà choisi (partage depuis une autre app). */
  initialFile?: File | null;
}) {
  const { toast } = useFeedback();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"input" | "analyzing" | "review" | "saving">("input");
  const [summary, setSummary] = useState("");
  const [events, setEvents] = useState<Row<ProposedEvent>[]>([]);
  const [todos, setTodos] = useState<Row<ProposedTodo>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setText("");
    setPhase("input");
    setSummary("");
    setEvents([]);
    setTodos([]);
    setError(null);
  };

  useEffect(() => {
    if (!open) reset();
    else if (initialFile) setFile(initialFile);
  }, [open, initialFile]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
      setError("Choisis une photo ou un PDF.");
      return;
    }
    setError(null);
    setFile(f);
  };

  // Coller une capture d'écran directement dans la fenêtre.
  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const pasted = item?.getAsFile();
    if (pasted) {
      e.preventDefault();
      pickFile(pasted);
    }
  };

  const analyze = async () => {
    if (!file && !text.trim()) return;
    setError(null);
    setPhase("analyzing");
    try {
      const form = new FormData();
      if (file) {
        if (file.type === "application/pdf") form.append("file", file);
        else {
          const blob = await prepareImage(file).catch(() => null);
          if (!blob) {
            setError("Cette photo n'a pas pu être lue. Essaie une capture d'écran ou un JPEG.");
            setPhase("input");
            return;
          }
          form.append("file", blob, "photo.jpg");
        }
      }
      if (text.trim()) form.append("text", text.trim());
      if (groupId) form.append("groupId", groupId);
      form.append("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      form.append("today", localToday());

      const res = await fetch("/api/import/ai", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "L'analyse a échoué.");
        setPhase("input");
        return;
      }
      if (status && typeof data.remaining === "number") onStatusChange({ ...status, remaining: data.remaining });
      let key = 0;
      setSummary(data.summary || "");
      setEvents((data.events as ProposedEvent[]).map((e) => ({ ...e, key: key++, selected: true })));
      setTodos((data.todos as ProposedTodo[]).map((t) => ({ ...t, key: key++, selected: true })));
      setPhase("review");
    } catch {
      setError("Connexion impossible. Vérifie le réseau et réessaie.");
      setPhase("input");
    }
  };

  const updateEvent = (key: number, patch: Partial<ProposedEvent & { selected: boolean }>) =>
    setEvents((all) => all.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  const updateTodo = (key: number, patch: Partial<ProposedTodo & { selected: boolean }>) =>
    setTodos((all) => all.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const chosenEvents = events.filter((e) => e.selected && e.title.trim() && e.date);
  const chosenTodos = todos.filter((t) => t.selected && t.title.trim());
  const chosenCount = chosenEvents.length + chosenTodos.length;

  const save = async () => {
    if (chosenCount === 0) return;
    setPhase("saving");
    const created: Array<{ kind: "calendar" | "todos"; id: string }> = [];
    let failed = 0;

    for (const e of chosenEvents) {
      const timed = !!e.time;
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: e.title.trim(),
          description: e.description.trim() || null,
          date: timed ? new Date(`${e.date}T${e.time}`).toISOString() : `${e.date}T00:00:00.000Z`,
          // Journées entières : fin exclusive, le lendemain du dernier jour.
          endDate: timed
            ? e.endTime
              ? new Date(`${e.date}T${e.endTime}`).toISOString()
              : null
            : e.endDate && e.endDate > e.date
              ? `${nextDay(e.endDate)}T00:00:00.000Z`
              : null,
          allDay: !timed,
          recurrence: e.recurrence || null,
          groupId,
          assigneeIds: e.assigneeIds,
        }),
      }).catch(() => null);
      if (res?.ok) created.push({ kind: "calendar", id: (await res.json()).id });
      else failed++;
    }

    for (const t of chosenTodos) {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t.title.trim(),
          description: t.description.trim() || null,
          priority: t.dueDate ? "PLANNED" : "URGENT",
          dueDate: t.dueDate || null,
          groupId,
          assigneeIds: t.assigneeIds,
        }),
      }).catch(() => null);
      if (res?.ok) created.push({ kind: "todos", id: (await res.json()).id });
      else failed++;
    }

    onImported();
    onOpenChange(false);

    const nEvents = created.filter((c) => c.kind === "calendar").length;
    const nTodos = created.length - nEvents;
    const parts = [
      nEvents ? `${nEvents} événement${nEvents > 1 ? "s" : ""}` : null,
      nTodos ? `${nTodos} tâche${nTodos > 1 ? "s" : ""}` : null,
    ].filter(Boolean);
    if (created.length === 0) {
      toast("Rien n'a pu être ajouté. Réessaie.", "error");
      return;
    }
    toast(
      `${parts.join(" et ")} ajouté${created.length > 1 ? "s" : ""}${failed ? ` (${failed} en échec)` : ""}`,
      failed ? "error" : "success",
      {
        label: "Annuler",
        onClick: async () => {
          await Promise.all(created.map((c) => fetch(`/api/${c.kind}/${c.id}`, { method: "DELETE" }).catch(() => null)));
          onImported();
          toast("Import annulé", "info");
        },
      }
    );
  };

  const busy = phase === "analyzing" || phase === "saving";

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            {phase === "review" || phase === "saving" ? "Vérifie avant d'ajouter" : "Importer avec l'IA"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {phase === "review" || phase === "saving"
              ? summary || "Voici ce qui a été trouvé. Corrige ou décoche ce qui ne va pas."
              : "Une circulaire de l'école, un planning, une convocation, un email : les dates deviennent des événements et des tâches, que tu relis avant de les ajouter."}
          </p>
        </DialogHeader>

        {(phase === "input" || phase === "analyzing") && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "relative rounded-lg border-2 border-dashed transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              {file ? (
                <div className="flex items-center gap-3 p-3">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="h-20 w-20 rounded-md object-cover shrink-0" />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-md bg-secondary shrink-0">
                      <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name || "Image collée"}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.type === "application/pdf" ? "PDF" : "Photo"} · {Math.max(1, Math.round(file.size / 1024))} Ko
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={busy}
                    aria-label="Retirer le fichier"
                    className="p-2 touch:p-3 rounded-md text-muted-foreground hover:bg-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 px-4 py-8 text-center"
                >
                  <span className="flex gap-2 text-muted-foreground" aria-hidden>
                    <ImageIcon className="h-6 w-6" />
                    <Upload className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium">Prendre une photo ou choisir un fichier</span>
                  <span className="text-xs text-muted-foreground">Photo ou PDF, 10 Mo au plus. Tu peux aussi glisser ou coller une image.</span>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-import-text">{file ? "Précisions (facultatif)" : "Ou colle un texte"}</Label>
              <Textarea
                id="ai-import-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={file ? 2 : 5}
                maxLength={20000}
                placeholder={
                  file
                    ? "Ex. : seulement ce qui concerne la classe de Léa"
                    : "Ex. : le contenu d'un email du club de foot, avec les dates des matchs"
                }
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {status ? `${status.remaining} analyse${status.remaining > 1 ? "s" : ""} restante${status.remaining > 1 ? "s" : ""} aujourd'hui · ` : ""}
                Le document est lu par Claude (Anthropic) et n&apos;est pas conservé.
              </p>
              <Button onClick={analyze} disabled={busy || (!file && !text.trim()) || status?.remaining === 0}>
                {phase === "analyzing" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                    Lecture en cours…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" aria-hidden />
                    Analyser
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {(phase === "review" || phase === "saving") && (
          <div className="space-y-5">
            {events.length === 0 && todos.length === 0 && (
              <p className="rounded-lg bg-secondary p-4 text-sm">
                Aucune date ni tâche trouvée dans ce document.
              </p>
            )}

            {events.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Événements ({events.filter((e) => e.selected).length}/{events.length})
                </h3>
                {events.map((e) => (
                  <div
                    key={e.key}
                    className={cn("rounded-lg border p-3 space-y-2 transition-opacity", !e.selected && "opacity-50")}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={e.selected}
                        onCheckedChange={(v) => updateEvent(e.key, { selected: v === true })}
                        aria-label={`Ajouter « ${e.title} »`}
                        className="touch:h-5 touch:w-5"
                      />
                      <Input
                        value={e.title}
                        onChange={(ev) => updateEvent(e.key, { title: ev.target.value })}
                        aria-label="Titre"
                        className="h-8 font-medium"
                      />
                    </div>
                    {e.selected && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <Label htmlFor={`ai-e-date-${e.key}`} className="text-xs text-muted-foreground">Date</Label>
                            <Input id={`ai-e-date-${e.key}`} type="date" value={e.date} className="h-8"
                              onChange={(ev) => updateEvent(e.key, { date: ev.target.value })} />
                          </div>
                          {e.time || !e.endDate ? (
                            <>
                              <div>
                                <Label htmlFor={`ai-e-time-${e.key}`} className="text-xs text-muted-foreground">Début</Label>
                                <Input id={`ai-e-time-${e.key}`} type="time" value={e.time} className="h-8"
                                  onChange={(ev) => updateEvent(e.key, { time: ev.target.value, endTime: ev.target.value ? e.endTime : "" })} />
                              </div>
                              <div>
                                <Label htmlFor={`ai-e-end-${e.key}`} className="text-xs text-muted-foreground">Fin</Label>
                                <Input id={`ai-e-end-${e.key}`} type="time" value={e.endTime} disabled={!e.time} className="h-8"
                                  onChange={(ev) => updateEvent(e.key, { endTime: ev.target.value })} />
                              </div>
                            </>
                          ) : (
                            <div>
                              <Label htmlFor={`ai-e-last-${e.key}`} className="text-xs text-muted-foreground">Jusqu&apos;au</Label>
                              <Input id={`ai-e-last-${e.key}`} type="date" value={e.endDate} min={e.date} className="h-8"
                                onChange={(ev) => updateEvent(e.key, { endDate: ev.target.value })} />
                            </div>
                          )}
                          <p className="col-span-2 sm:col-span-1 self-end pb-1.5 text-xs text-muted-foreground">
                            {e.date && dayLabel(e.date)}
                            {!e.time && (e.endDate ? ` → ${dayLabel(e.endDate)}` : " · journée")}
                            {e.recurrence && ` · ${RECURRENCE_LABELS[e.recurrence]}`}
                          </p>
                        </div>
                        {e.description && <p className="text-xs text-muted-foreground whitespace-pre-line">{e.description}</p>}
                        {profiles.length > 0 && (
                          <AssigneePicker
                            profiles={profiles}
                            value={e.assigneeIds}
                            onChange={(assigneeIds) => updateEvent(e.key, { assigneeIds })}
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </section>
            )}

            {todos.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CheckSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Tâches ({todos.filter((t) => t.selected).length}/{todos.length})
                </h3>
                {todos.map((t) => (
                  <div
                    key={t.key}
                    className={cn("rounded-lg border p-3 space-y-2 transition-opacity", !t.selected && "opacity-50")}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={t.selected}
                        onCheckedChange={(v) => updateTodo(t.key, { selected: v === true })}
                        aria-label={`Ajouter « ${t.title} »`}
                        className="touch:h-5 touch:w-5"
                      />
                      <Input
                        value={t.title}
                        onChange={(ev) => updateTodo(t.key, { title: ev.target.value })}
                        aria-label="Titre"
                        className="h-8 font-medium"
                      />
                    </div>
                    {t.selected && (
                      <>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="w-40">
                            <Label htmlFor={`ai-t-due-${t.key}`} className="text-xs text-muted-foreground">Échéance</Label>
                            <Input id={`ai-t-due-${t.key}`} type="date" value={t.dueDate} className="h-8"
                              onChange={(ev) => updateTodo(t.key, { dueDate: ev.target.value })} />
                          </div>
                          {t.description && <p className="pb-1.5 text-xs text-muted-foreground">{t.description}</p>}
                        </div>
                        {profiles.length > 0 && (
                          <AssigneePicker
                            profiles={profiles}
                            value={t.assigneeIds}
                            onChange={(assigneeIds) => updateTodo(t.key, { assigneeIds })}
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </section>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setPhase("input")} disabled={busy}>
                Recommencer
              </Button>
              <Button onClick={save} disabled={busy || chosenCount === 0}>
                {phase === "saving" && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
                {chosenCount === 0 ? "Rien à ajouter" : `Ajouter ${chosenCount} élément${chosenCount > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
