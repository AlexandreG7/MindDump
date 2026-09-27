"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGroupContext } from "@/components/GroupContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertCircle, Calendar, Repeat } from "lucide-react";
import { RECURRENCE_LABELS, RECURRENCE_OPTIONS } from "@/lib/recurrence";
import { TOAST_ACTION_DURATION, useFeedback } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AssigneeAvatars,
  AssigneePicker,
  PeopleFilter,
  matchesPeople,
  useFamilyProfiles,
} from "@/components/profiles/Assignees";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  priority: "URGENT" | "PLANNED";
  dueDate: string | null;
  completed: boolean;
  recurrence: string | null;
  notifyBefore: number | null;
  assigneeIds?: string[];
}

const PEOPLE_KEY = "todos:people";

export default function TodosPage() {
  const { status, isReady } = useAuth();
  const { currentGroupId } = useGroupContext();
  const { toast, dismiss } = useFeedback();
  // null tant que le premier chargement n'est pas revenu.
  const [todos, setTodos] = useState<Todo[] | null>(null);
  // Suppressions en attente : la tâche disparaît tout de suite, la requête part
  // à la fin du délai d'annulation.
  const pendingDeletes = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; toastId: number }>());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: "",
    description: "",
    priority: "URGENT" as "URGENT" | "PLANNED",
    dueDate: "",
    recurrence: "",
    notifyBefore: "",
  });
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const profiles = useFamilyProfiles(currentGroupId);
  const [peopleFilter, setPeopleFilter] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PEOPLE_KEY) ?? "[]");
      if (Array.isArray(saved)) setPeopleFilter(saved.filter((v) => typeof v === "string"));
    } catch {}
  }, []);

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

  const addTodo = async () => {
    if (!newTodo.title.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTodo.title,
        description: newTodo.description || null,
        priority: newTodo.priority,
        dueDate: newTodo.dueDate || null,
        recurrence: newTodo.dueDate ? newTodo.recurrence || null : null,
        notifyBefore: newTodo.notifyBefore ? Number(newTodo.notifyBefore) : null,
        groupId: currentGroupId,
        assigneeIds: newAssignees,
      }),
    });
    setNewTodo({
      title: "",
      description: "",
      priority: "URGENT",
      dueDate: "",
      recurrence: "",
      notifyBefore: "",
    });
    setNewAssignees([]);
    setDialogOpen(false);
    fetchTodos();
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    setTodos((all) => all?.map((t) => (t.id === id ? { ...t, completed: !completed } : t)) ?? all);
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !completed }),
    }).catch(() => null);
    if (!res?.ok) toast("La tâche n'a pas pu être mise à jour.", "error");
    // Recharge aussi pour voir l'occurrence suivante d'une tâche récurrente.
    fetchTodos();
  };

  const sendDelete = (id: string) => {
    pendingDeletes.current.delete(id);
    return fetch(`/api/todos/${id}`, { method: "DELETE", keepalive: true }).catch(() => null);
  };

  const deleteTodo = (todo: Todo) => {
    setHidden((h) => new Set(h).add(todo.id));
    const timer = setTimeout(async () => {
      const res = await sendDelete(todo.id);
      if (!res?.ok) toast("La tâche n'a pas pu être supprimée.", "error");
      fetchTodos();
    }, TOAST_ACTION_DURATION);
    const toastId = toast(`« ${todo.title} » supprimée`, "info", {
      label: "Annuler",
      onClick: () => {
        clearTimeout(pendingDeletes.current.get(todo.id)?.timer);
        pendingDeletes.current.delete(todo.id);
        setHidden((h) => {
          const next = new Set(h);
          next.delete(todo.id);
          return next;
        });
      },
    });
    pendingDeletes.current.set(todo.id, { timer, toastId });
  };

  // En quittant la page, les suppressions en attente partent tout de suite.
  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      pending.forEach(({ timer, toastId }, id) => {
        clearTimeout(timer);
        dismiss(toastId);
        sendDelete(id);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    }
  };

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

    return (
      <div className="space-y-2">
        {pending.map((todo) => (
          <Card key={todo.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <Checkbox
                checked={todo.completed}
                onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="min-w-0">{todo.title}</span>
                  <AssigneeAvatars ids={todo.assigneeIds} byId={profiles.byId} />
                </p>
                {todo.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {todo.description}
                  </p>
                )}
                {(todo.dueDate || todo.recurrence) && (
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                    {todo.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(todo.dueDate).toLocaleDateString("fr-FR")}
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
              </div>
              <Button aria-label="Supprimer la tâche"
                variant="ghost"
                size="icon"
                onClick={() => deleteTodo(todo)}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}

        {done.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Terminées ({done.length})
            </p>
            {done.map((todo) => (
              <Card key={todo.id} className="opacity-50 mb-2">
                <CardContent className="flex items-center gap-3 p-4">
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
                  />
                  <p className="text-sm line-through flex-1">{todo.title}</p>
                  <Button aria-label="Supprimer la tâche"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTodo(todo)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle tâche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une tâche</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Titre</Label>
                <Input
                  value={newTodo.title}
                  onChange={(e) =>
                    setNewTodo({ ...newTodo, title: e.target.value })
                  }
                  placeholder="Qu'est-ce qu'il faut faire ?"
                />
              </div>
              <div>
                <Label>Description (optionnel)</Label>
                <Textarea
                  value={newTodo.description}
                  onChange={(e) =>
                    setNewTodo({ ...newTodo, description: e.target.value })
                  }
                  placeholder="Détails…"
                />
              </div>
              {profiles.assignable.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Pour qui ?</Label>
                  <AssigneePicker
                    profiles={profiles.assignable}
                    value={newAssignees}
                    onChange={setNewAssignees}
                  />
                </div>
              )}
              <div>
                <Label>Priorité</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={
                      newTodo.priority === "URGENT" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      setNewTodo({ ...newTodo, priority: "URGENT" })
                    }
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Urgent
                  </Button>
                  <Button
                    type="button"
                    variant={
                      newTodo.priority === "PLANNED" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      setNewTodo({ ...newTodo, priority: "PLANNED" })
                    }
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Planifié
                  </Button>
                </div>
              </div>
              {newTodo.priority === "PLANNED" && (
                <>
                  <div>
                    <Label>Date d&apos;échéance</Label>
                    <Input
                      type="datetime-local"
                      value={newTodo.dueDate}
                      onChange={(e) =>
                        setNewTodo({ ...newTodo, dueDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Récurrence</Label>
                    <Select
                      value={newTodo.recurrence}
                      onValueChange={(v) =>
                        setNewTodo({
                          ...newTodo,
                          recurrence: v === "none" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucune" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {RECURRENCE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newTodo.recurrence && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Une nouvelle occurrence sera créée automatiquement quand
                        tu coches la tâche.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Rappel (minutes avant)</Label>
                    <Input
                      type="number"
                      value={newTodo.notifyBefore}
                      onChange={(e) =>
                        setNewTodo({ ...newTodo, notifyBefore: e.target.value })
                      }
                      placeholder="30"
                    />
                  </div>
                </>
              )}
              <Button className="w-full" onClick={addTodo}>
                Ajouter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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

      <Tabs defaultValue="urgent">
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
