"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { nativeHaptic } from "@/lib/native";
import { notifyRemindersChanged } from "@/lib/localReminders";
import { useGroupContext } from "@/components/GroupContext";
import { useDeferredDelete } from "@/lib/useDeferredDelete";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedList, SegmentedTrigger } from "@/components/ui/segmented";
import { ModuleHero, HeroChip, HeroIconButton } from "@/components/ui/module-hero";
import { SwipeRow } from "@/components/ui/swipe-row";
import { FlipList } from "@/components/ui/flip-list";
import { burst, prefersReducedMotion, useJustReachedZero } from "@/lib/motionUi";
import { CheckCircle } from "@/components/ui/check-circle";
import { QuickAdd } from "@/components/ui/quick-add";
import { EmptyState } from "@/components/ui/empty-state";
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
  late: "bg-destructive text-destructive-foreground font-extrabold",
  today: "bg-tone-todo text-on-tone font-extrabold",
  soon: "bg-secondary text-secondary-foreground font-bold",
  later: "bg-secondary text-secondary-foreground font-bold",
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
  // Instant du dernier cochage : la gerbe ne part que juste après un cochage, pas après un filtre ou une suppression.
  const lastCheckAt = useRef(0);
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
    if (!completed) {
      nativeHaptic();
      lastCheckAt.current = Date.now();
    }
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

  // Lignes en train de sortir : un court fondu avant que la suppression
  // (annulable) ne parte, sauf en mouvement réduit.
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const deleteTodo = (todo: Todo) => {
    if (prefersReducedMotion()) return doDelete(todo);
    setLeaving((l) => new Set(l).add(todo.id));
    window.setTimeout(() => {
      doDelete(todo);
      setLeaving((l) => {
        const next = new Set(l);
        next.delete(todo.id);
        return next;
      });
    }, 220);
  };
  const doDelete = (todo: Todo) => {
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
    setActiveTab("urgent");
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

  // Compteur de l'en-tête et félicitations quand la dernière tâche est cochée.
  const activePeople = peopleFilter.filter((id) => profiles.assignable.some((p) => p.id === id));
  const pendingNow =
    todos === null
      ? null
      : todos.filter((t) => !hidden.has(t.id) && !t.completed && matchesPeople(t.assigneeIds, activePeople)).length;
  const cleared = useJustReachedZero(pendingNow);
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!cleared || Date.now() - lastCheckAt.current > 1500) return;
    nativeHaptic();
    burst(heroRef.current?.querySelector(".odo") ?? heroRef.current, {
      count: 22,
      radius: 120,
      size: 16,
      colors: ["hsl(var(--on-tone))", "hsl(var(--on-ink))"],
    });
  }, [cleared]);

  if (!isReady) return null;

  const visibleTodos = (todos ?? []).filter((t) => !hidden.has(t.id));
  // Filtre « qui » : les tâches sans personne assignée restent toujours affichées.
  const activeFilter = activePeople;
  const shown = visibleTodos.filter((t) => matchesPeople(t.assigneeIds, activeFilter));

  const urgentTodos = shown.filter((t) => t.priority === "URGENT");
  const plannedTodos = shown.filter((t) => t.priority === "PLANNED");
  const urgentLeft = urgentTodos.filter((t) => !t.completed).length;
  const plannedLeft = plannedTodos.filter((t) => !t.completed).length;
  const lateCount = shown.filter((t) => !t.completed && t.dueDate && dueLabel(t.dueDate).state === "late").length;

  const renderTodoList = (items: Todo[]) => {
    if (todos === null) {
      return (
        <div className="space-y-2.5" aria-busy="true" aria-label="Chargement des tâches">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-[1.5rem] bg-card p-4 shadow-surface">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-[60%]" />
            </div>
          ))}
        </div>
      );
    }

    const pending = items.filter((t) => !t.completed);
    const done = items.filter((t) => t.completed);

    // Toute la ligne ouvre la fiche (souris, toucher, Entrée ou Espace) ; la
    // case et la corbeille gardent leur propre action. Au doigt, on peut aussi
    // glisser la ligne : à droite pour cocher, à gauche pour supprimer.
    const renderRow = (todo: Todo) => {
      const due = todo.dueDate && !todo.completed ? dueLabel(todo.dueDate) : null;
      return (
        <SwipeRow
          key={todo.id}
          data-flip={todo.id}
          id={`todo-${todo.id}`}
          tone="todo"
          onSwipeRight={() => toggleTodo(todo.id, todo.completed)}
          onSwipeLeft={() => deleteTodo(todo)}
          onClick={() => setOpenId(todo.id)}
          className={cn(
            "shadow-surface transition-[opacity,transform] duration-200 ease-out",
            leaving.has(todo.id) && "pointer-events-none -translate-x-6 opacity-0",
            highlightId === todo.id && "ring-[3px] ring-tone-todo"
          )}
          frontClassName={cn(
            "group/card flex cursor-pointer items-center gap-1 bg-card py-3.5 pl-1.5 pr-2 transition-colors duration-150 hover:bg-accent/40 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring/60",
            todo.completed && "bg-card/70"
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
            className="min-w-0 flex-1 rounded-sm py-0.5 pl-1.5 text-left focus-visible:outline-none"
          >
            <div className={cn("text-[1.0625rem] font-bold leading-snug text-pretty", todo.completed && "font-semibold text-muted-foreground")}>
              <span className="strike" data-done={todo.completed}>{todo.title}</span>
            </div>
            {todo.description && !todo.completed && (
              <div className="mt-0.5 truncate text-sm text-muted-foreground">{todo.description}</div>
            )}
            {!todo.completed && !!(due || todo.recurrence || todo.assigneeIds?.length) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                {due && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 tabular-nums", DUE_CHIP[due.state])}>
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
            className="h-12 w-12 shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 touch:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </SwipeRow>
      );
    };

    return (
      <div>
        {pending.length === 0 && done.length > 0 && (
          <p className="mb-2 flex items-center gap-2 rounded-full bg-tone-todo-soft px-4 py-3 text-base font-extrabold text-tone-todo-ink">
            <CheckCheck className="h-5 w-5 shrink-0" aria-hidden />
            Tout est fait ici.
          </p>
        )}
        <FlipList signature={`${pending.map((t) => t.id).join(",")}|${done.map((t) => t.id).join(",")}`} className="space-y-2.5">
          {pending.map((t) => renderRow(t))}

          {done.length > 0 && (
            <p data-flip="__done" className="px-1 pb-0.5 pt-4 text-base font-extrabold text-muted-foreground">
              Terminées <span className="tabular-nums">({done.length})</span>
            </p>
          )}
          {done.map((t) => renderRow(t))}
        </FlipList>


        {items.length === 0 && (
          <EmptyState icon={CheckCheck} tone="todo" title="Rien à faire ici.">
            Profite, ou note ce qui te trotte dans la tête juste au-dessus.
          </EmptyState>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 md:mx-0">
      <div ref={heroRef}>
        <ModuleHero
          tone="todo"
          title="Tâches"
          count={pendingNow}
          countLabel={pendingNow === 0 ? "Tout est rangé. Respire." : "à faire"}
          action={
            <>
              {aiStatus?.enabled && (
                <HeroIconButton
                  onClick={() => setAiDialogOpen(true)}
                  title="Importer une photo, un PDF ou un texte avec l'IA"
                  aria-label="Importer avec l'IA"
                >
                  <Sparkles className="h-4 w-4" />
                </HeroIconButton>
              )}
              <HeroIconButton
                onClick={() => setCreating(true)}
                title="Nouvelle tâche avec échéance, rappel ou personnes"
                aria-label="Nouvelle tâche détaillée"
                className="bg-on-tone text-tone-todo hover:bg-on-tone/90"
              >
                <Plus className="h-6 w-6" strokeWidth={3} />
              </HeroIconButton>
            </>
          }
        >
          {todos !== null && (
            <>
              <HeroChip>{urgentLeft} urgente{urgentLeft > 1 ? "s" : ""}</HeroChip>
              <HeroChip>{plannedLeft} planifiée{plannedLeft > 1 ? "s" : ""}</HeroChip>
              {lateCount > 0 && (
                <HeroChip className="bg-destructive text-destructive-foreground">
                  {lateCount} en retard
                </HeroChip>
              )}
            </>
          )}
        </ModuleHero>
      </div>
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
        tone="todo"
        value={quickAdd}
        onChange={setQuickAdd}
        onSubmit={submitQuickAdd}
        placeholder="Ajout rapide d’une tâche urgente…"
        label="Ajout rapide d’une tâche urgente"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "urgent" | "planned")}>
        <SegmentedList>
          <SegmentedTrigger value="urgent" tone="todo" icon={<AlertCircle className="h-4 w-4" />} count={urgentLeft}>
            Urgent
          </SegmentedTrigger>
          <SegmentedTrigger value="planned" tone="todo" icon={<Calendar className="h-4 w-4" />} count={plannedLeft}>
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
