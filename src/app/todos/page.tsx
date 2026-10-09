"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { nativeHaptic } from "@/lib/native";
import { notifyRemindersChanged } from "@/lib/localReminders";
import { useGroupContext } from "@/components/GroupContext";
import { useDeferredDelete } from "@/lib/useDeferredDelete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, AlertCircle, Bell, Calendar, Repeat, Sparkles } from "lucide-react";
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

/** « 12/10/2026 à 14:30 » en heure locale. */
function formatDue(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

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
  const handleQuickAdd = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickAdd.trim()) {
      await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: quickAdd, priority: "URGENT", groupId: currentGroupId }),
      });
      setQuickAdd("");
      fetchTodos();
      notifyRemindersChanged();
    }
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
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 flex-1 max-w-[60%]" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    const pending = items.filter((t) => !t.completed);
    const done = items.filter((t) => t.completed);

    // Toute la ligne ouvre la fiche (souris, toucher, Entrée ou Espace) ; la
    // case et la corbeille gardent leur propre action.
    const renderRow = (todo: Todo) => (
      <Card
        key={todo.id}
        id={`todo-${todo.id}`}
        onClick={() => setOpenId(todo.id)}
        className={cn(
          "cursor-pointer transition-[box-shadow,background-color] hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring/60",
          todo.completed && "opacity-60",
          highlightId === todo.id && "ring-2 ring-primary"
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <span
            className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={todo.completed}
              onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
              aria-label={`${todo.completed ? "Décocher" : "Cocher"} « ${todo.title} »`}
            />
          </span>
          {/* Cible clavier et lecteur d'écran de la ligne ; le clic souris ou tactile est capté par la carte. */}
          <button
            type="button"
            aria-label={`Ouvrir la tâche « ${todo.title} »`}
            className="flex-1 min-w-0 text-left rounded-sm focus-visible:outline-none"
          >
            <div
              className={cn(
                "text-sm font-medium flex items-center gap-2",
                todo.completed && "line-through font-normal"
              )}
            >
              <span className="min-w-0">{todo.title}</span>
              <AssigneeAvatars ids={todo.assigneeIds} byId={profiles.byId} />
            </div>
            {todo.description && !todo.completed && (
              <div className="text-xs text-muted-foreground truncate">{todo.description}</div>
            )}
            {(todo.dueDate || todo.recurrence) && !todo.completed && (
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {todo.dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDue(todo.dueDate)}
                  </span>
                )}
                {todo.dueDate && todo.notifyBefore !== null && (
                  <span className="flex items-center gap-1">
                    <Bell className="h-3 w-3" />
                    {reminderLabel(todo.notifyBefore)}
                  </span>
                )}
                {todo.recurrence && RECURRENCE_LABELS[todo.recurrence] && (
                  <span className="flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    {RECURRENCE_LABELS[todo.recurrence]}
                  </span>
                )}
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
            className="shrink-0 -mr-2"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );

    return (
      <div className="space-y-2">
        {pending.map(renderRow)}

        {done.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Terminées ({done.length})
            </p>
            {done.map(renderRow)}
          </div>
        )}

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune tâche. Profite !
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes tâches</h1>
        <div className="flex items-center gap-1 sm:gap-2">
        {aiStatus?.enabled && (
          <button
            onClick={() => setAiDialogOpen(true)}
            className="p-2 touch:p-2.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            title="Importer une photo, un PDF ou un texte avec l'IA"
            aria-label="Importer avec l'IA"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        )}
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle tâche
        </Button>
        </div>
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

      {/* Quick add */}
      <Input
        placeholder="Ajout rapide d’une tâche urgente…"
        value={quickAdd}
        onChange={(e) => setQuickAdd(e.target.value)}
        onKeyDown={handleQuickAdd}
        enterKeyHint="done"
        aria-label="Ajout rapide d’une tâche urgente"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "urgent" | "planned")}>
        <TabsList>
          <TabsTrigger value="urgent" className="gap-1">
            <AlertCircle className="h-4 w-4" />
            Urgent ({urgentTodos.filter((t) => !t.completed).length})
          </TabsTrigger>
          <TabsTrigger value="planned" className="gap-1">
            <Calendar className="h-4 w-4" />
            Planifié ({plannedTodos.filter((t) => !t.completed).length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="urgent">{renderTodoList(urgentTodos)}</TabsContent>
        <TabsContent value="planned">
          {renderTodoList(plannedTodos)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
