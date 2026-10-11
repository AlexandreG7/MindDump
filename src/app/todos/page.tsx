"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { nativeHaptic } from "@/lib/native";
import { notifyRemindersChanged } from "@/lib/localReminders";
import { useGroupContext } from "@/components/GroupContext";
import { useDeferredDelete } from "@/lib/useDeferredDelete";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedList, SegmentedTrigger } from "@/components/ui/segmented";
import { PageHeader } from "@/components/ui/page-header";
import { CheckCircle } from "@/components/ui/check-circle";
import { QuickAdd } from "@/components/ui/quick-add";
import { EmptyState } from "@/components/ui/empty-state";
import { Surface } from "@/components/ui/surface";
import { dueLabel, type DueState } from "@/lib/dueLabel";
import { Plus, Trash2, AlertCircle, Bell, Calendar, CheckCheck, Repeat, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { reminderLabel } from "@/lib/reminderOptions";
import { RECURRENCE_LABELS } from "@/lib/recurrence";
import { TodoSheet, type Todo, type TodoPayload } from "@/components/todos/TodoSheet";
import { useFeedback } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AssigneeAvatars,
  PeopleFilter,
  matchesPeople,
  useFamilyProfiles,
} from "@/components/profiles/Assignees";
import { AiImportDialog, useAiImportStatus } from "@/components/import/AiImportDialog";

const PEOPLE_KEY = "todos:people";

const DUE_CHIP: Record<DueState, string> = {
  late: "bg-destructive/10 text-destructive font-semibold",
  today: "bg-tone-todo-soft text-tone-todo-ink font-semibold",
  soon: "bg-secondary text-secondary-foreground",
  later: "bg-secondary text-secondary-foreground",
};

// useSearchParams exige une frontière Suspense pour le rendu statique.
export default function TodosPage() {
  return (
    <Suspense fallback={null}>
      <TodosPageContent />
    </Suspense>
  );
}

function TodosPageContent() {
  const { status, isReady } = useAuth();
  const { currentGroupId } = useGroupContext();
  const { toast } = useFeedback();
  // null tant que le premier chargement n'est pas revenu.
  const [todos, setTodos] = useState<Todo[] | null>(null);
  // Suppressions en attente : la tâche disparaît tout de suite, la requête part
  // à la fin du délai d'annulation.
  const { hidden, requestDelete } = useDeferredDelete({ affectsReminders: true });
  // Fiche ouverte : une tâche existante (openId) ou une nouvelle (creating).
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const profiles = useFamilyProfiles(currentGroupId);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiStatus, setAiStatus] = useAiImportStatus();
  const [peopleFilter, setPeopleFilter] = useState<string[]>([]);
  // Ouverte depuis un rappel (?task=<id>) : fait défiler jusqu'à la tâche et
  // la met en évidence un instant (docs/app-mobile.md, étape 3.3).
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PEOPLE_KEY) ?? "[]");
      if (Array.isArray(saved)) setPeopleFilter(saved.filter((v) => typeof v === "string"));
    } catch {}
  }, []);

  // Lu à chaque changement d'URL : un rappel touché alors que l'app est déjà
  // sur /todos (router.push vers /todos?task=…) met aussi la tâche en évidence.
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskParam = searchParams.get("task");
  useEffect(() => {
    if (!taskParam) return;
    setHighlightId(taskParam);
    setOpenId(taskParam);
    // Paramètre consommé : on le retire pour qu'un second appui sur le même
    // rappel (URL identique sinon) déclenche de nouveau la mise en évidence.
    router.replace("/todos", { scroll: false });
  }, [taskParam, router]);

  const [activeTab, setActiveTab] = useState<"urgent" | "planned">("urgent");

  const changePeopleFilter = (ids: string[]) => {
    setPeopleFilter(ids);
    try {
      localStorage.setItem(PEOPLE_KEY, JSON.stringify(ids));
    } catch {}
  };

  const fetchTodos = useCallback(() => {
    const url = currentGroupId ? `/api/todos?groupId=${currentGroupId}` : "/api/todos";
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setTodos)
      .catch(() => {
        setTodos((prev) => prev ?? []);
        toast("Impossible de charger les tâches.", "error");
      });
  }, [currentGroupId, toast]);

  useEffect(() => {
    if (isReady) fetchTodos();
  }, [isReady, fetchTodos, currentGroupId]);

  // Création ou modification depuis la fiche. Renvoie true si ça a marché.
  const saveTodo = async (payload: TodoPayload, existing: Todo | null): Promise<boolean> => {
    const res = await fetch(existing ? `/api/todos/${existing.id}` : "/api/todos", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(existing ? payload : { ...payload, groupId: currentGroupId }),
    }).catch(() => null);
    if (!res?.ok) {
      toast(
        existing ? "La tâche n'a pas pu être enregistrée." : "La tâche n'a pas pu être ajoutée.",
        "error"
      );
      return false;
    }
    fetchTodos();
    notifyRemindersChanged();
    return true;
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    if (!completed) nativeHaptic();
    setTodos((all) => all?.map((t) => (t.id === id ? { ...t, completed: !completed } : t)) ?? all);
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !completed }),
    }).catch(() => null);
    if (!res?.ok) toast("La tâche n'a pas pu être mise à jour.", "error");
    // Recharge aussi pour voir l'occurrence suivante d'une tâche récurrente.
    fetchTodos();
    notifyRemindersChanged();
  };

  const deleteTodo = (todo: Todo) => {
    requestDelete({
      id: todo.id,
      url: `/api/todos/${todo.id}`,
      confirmMessage: `« ${todo.title} » supprimée`,
      errorMessage: "La tâche n'a pas pu être supprimée.",
      refresh: () => {
        fetchTodos();
        notifyRemindersChanged();
      },
    });
  };

  // Quick add with Enter
  const [quickAdd, setQuickAdd] = useState("");
  const submitQuickAdd = async () => {
    if (!quickAdd.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: quickAdd, priority: "URGENT", groupId: currentGroupId }),
    });
    setQuickAdd("");
    fetchTodos();
    notifyRemindersChanged();
  };

  const highlightedTodo = highlightId ? (todos ?? []).find((t) => t.id === highlightId) : undefined;
  const highlightedTodoId = highlightedTodo?.id;
  const highlightedPriority = highlightedTodo?.priority;

  // Dès que la tâche visée est chargée : bon onglet, puis défilement et
  // coup de projecteur, qui s'efface après un instant (l'URL garde `?task=`
  // sans effet si on revient sur la page).
  useEffect(() => {
    if (!highlightedTodoId) return;
    setActiveTab(highlightedPriority === "URGENT" ? "urgent" : "planned");
    const id = window.setTimeout(() => {
      document.getElementById(`todo-${highlightedTodoId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    const clear = window.setTimeout(() => setHighlightId(null), 3000);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(clear);
    };
  }, [highlightedTodoId, highlightedPriority]);

  const openTodo = openId ? (todos ?? []).find((t) => t.id === openId) ?? null : null;
  const sheetOpen = creating || !!openTodo;

  // Lien profond vers une tâche supprimée ou hors de portée.
  useEffect(() => {
    if (openId && todos && !todos.some((t) => t.id === openId)) {
      setOpenId(null);
      toast("Cette tâche n'existe plus.", "error");
    }
  }, [openId, todos, toast]);

  if (!isReady) return null;

  const visibleTodos = (todos ?? []).filter((t) => !hidden.has(t.id));
  // Filtre « qui » : les tâches sans personne assignée restent toujours affichées.
  const activeFilter = peopleFilter.filter((id) => profiles.assignable.some((p) => p.id === id));
  const shown = visibleTodos.filter((t) => matchesPeople(t.assigneeIds, activeFilter));

  const urgentTodos = shown.filter((t) => t.priority === "URGENT");
  const plannedTodos = shown.filter((t) => t.priority === "PLANNED");

  const renderTodoList = (items: Todo[]) => {
    if (todos === null) {
      return (
        <div className="space-y-2" aria-busy="true" aria-label="Chargement des tâches">
          {[0, 1, 2].map((i) => (
            <Surface key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-[1.625rem] w-[1.625rem] rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-[60%]" />
            </Surface>
          ))}
        </div>
      );
    }

    const pending = items.filter((t) => !t.completed);
    const done = items.filter((t) => t.completed);

    // Toute la ligne ouvre la fiche (souris, toucher, Entrée ou Espace) ; la
    // case et la corbeille gardent leur propre action.
    const renderRow = (todo: Todo, index: number) => {
      const due = todo.dueDate && !todo.completed ? dueLabel(todo.dueDate) : null;
      return (
        <Surface
          key={todo.id}
          id={`todo-${todo.id}`}
          onClick={() => setOpenId(todo.id)}
          style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
          className={cn(
            "group/card flex animate-row-in cursor-pointer items-center gap-1 py-3 pl-1.5 pr-2 transition-[background-color,opacity] duration-150 hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring/60",
            todo.completed && "opacity-60",
            highlightId === todo.id && "ring-2 ring-primary"
          )}
        >
          <span onClick={(e) => e.stopPropagation()} className="flex">
            <CheckCircle
              tone="todo"
              checked={todo.completed}
              onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
              aria-label={`${todo.completed ? "Décocher" : "Cocher"} « ${todo.title} »`}
            />
          </span>
          {/* Cible clavier et lecteur d'écran de la ligne ; le clic souris ou tactile est capté par la carte. */}
          <button
            type="button"
            aria-label={`Ouvrir la tâche « ${todo.title} »`}
            className="min-w-0 flex-1 rounded-sm py-0.5 pl-1 text-left focus-visible:outline-none"
          >
            <div
              className={cn(
                "text-base font-medium leading-snug text-pretty",
                todo.completed && "font-normal text-muted-foreground line-through"
              )}
            >
              {todo.title}
            </div>
            {todo.description && !todo.completed && (
              <div className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">{todo.description}</div>
            )}
            {!todo.completed && (due || todo.recurrence || todo.assigneeIds?.length) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                {due && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums", DUE_CHIP[due.state])}>
                    <Calendar className="h-3 w-3" aria-hidden />
                    {due.text}
                  </span>
                )}
                {todo.dueDate && todo.notifyBefore !== null && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Bell className="h-3 w-3" aria-hidden />
                    {reminderLabel(todo.notifyBefore)}
                  </span>
                )}
                {todo.recurrence && RECURRENCE_LABELS[todo.recurrence] && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Repeat className="h-3 w-3" aria-hidden />
                    {RECURRENCE_LABELS[todo.recurrence]}
                  </span>
                )}
                <AssigneeAvatars ids={todo.assigneeIds} byId={profiles.byId} className="[&>*]:h-6 [&>*]:w-6 [&>*]:text-xs" />
              </div>
            )}
          </button>
          <Button
            aria-label="Supprimer la tâche"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              deleteTodo(todo);
            }}
            className="h-11 w-11 shrink-0 rounded-xl text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 touch:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Surface>
      );
    };

    return (
      <div className="space-y-2">
        {pending.map((t, i) => renderRow(t, i))}

        {done.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 px-1 text-[0.8125rem] font-semibold text-muted-foreground">
              Terminées <span className="tabular-nums">({done.length})</span>
            </p>
            <div className="space-y-2">{done.map((t, i) => renderRow(t, i))}</div>
          </div>
        )}

        {items.length === 0 && (
          <EmptyState icon={CheckCheck} tone="todo" title="Rien à faire ici">
            Profite, ou note ce qui te trotte dans la tête juste au-dessus.
          </EmptyState>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 md:mx-0">
      <PageHeader
        title="Mes tâches"
        meta={
          todos === null
            ? undefined
            : `${urgentTodos.filter((t) => !t.completed).length} urgentes · ${plannedTodos.filter((t) => !t.completed).length} planifiées`
        }
        action={
          <>
            {aiStatus?.enabled && (
              <button
                onClick={() => setAiDialogOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary"
                title="Importer une photo, un PDF ou un texte avec l'IA"
                aria-label="Importer avec l'IA"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
            <Button onClick={() => setCreating(true)} className="h-11 rounded-xl px-4 text-[0.9375rem]">
              <Plus className="mr-1.5 h-4 w-4" strokeWidth={2.5} />
              Nouvelle tâche
            </Button>
          </>
        }
      />
      <div className="contents">
        <TodoSheet
          open={sheetOpen}
          onOpenChange={(o) => {
            if (!o) {
              setCreating(false);
              setOpenId(null);
            }
          }}
          todo={creating ? null : openTodo}
          profiles={profiles.assignable}
          byId={profiles.byId}
          onSubmit={(payload) => saveTodo(payload, creating ? null : openTodo)}
          onToggle={(t) => toggleTodo(t.id, t.completed)}
          onDelete={deleteTodo}
        />
        <AiImportDialog
          open={aiDialogOpen}
          onOpenChange={setAiDialogOpen}
          groupId={currentGroupId}
          profiles={profiles.assignable}
          status={aiStatus}
          onStatusChange={setAiStatus}
          onImported={() => {
            fetchTodos();
            notifyRemindersChanged();
          }}
        />
      </div>

      <PeopleFilter profiles={profiles.assignable} value={activeFilter} onChange={changePeopleFilter} />

      <QuickAdd
        value={quickAdd}
        onChange={setQuickAdd}
        onSubmit={submitQuickAdd}
        placeholder="Ajout rapide d’une tâche urgente…"
        label="Ajout rapide d’une tâche urgente"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "urgent" | "planned")}>
        <SegmentedList>
          <SegmentedTrigger value="urgent" icon={<AlertCircle className="h-4 w-4" />} count={urgentTodos.filter((t) => !t.completed).length}>
            Urgent
          </SegmentedTrigger>
          <SegmentedTrigger value="planned" icon={<Calendar className="h-4 w-4" />} count={plannedTodos.filter((t) => !t.completed).length}>
            Planifié
          </SegmentedTrigger>
        </SegmentedList>
        <TabsContent value="urgent" className="mt-4">{renderTodoList(urgentTodos)}</TabsContent>
        <TabsContent value="planned" className="mt-4">
          {renderTodoList(plannedTodos)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
