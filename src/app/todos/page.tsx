"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Plus, Trash2, AlertCircle, Calendar } from "lucide-react";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  priority: "URGENT" | "PLANNED";
  dueDate: string | null;
  completed: boolean;
  notifyBefore: number | null;
}

export default function TodosPage() {
  const { status, isReady } = useAuth();
  const { currentGroupId } = useGroupContext();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: "",
    description: "",
    priority: "URGENT" as "URGENT" | "PLANNED",
    dueDate: "",
    notifyBefore: "",
  });

  const fetchTodos = useCallback(() => {
    const url = currentGroupId ? `/api/todos?groupId=${currentGroupId}` : "/api/todos";
    fetch(url).then((r) => r.json()).then(setTodos);
  }, [currentGroupId]);

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
        notifyBefore: newTodo.notifyBefore ? Number(newTodo.notifyBefore) : null,
        groupId: currentGroupId,
      }),
    });
    setNewTodo({ title: "", description: "", priority: "URGENT", dueDate: "", notifyBefore: "" });
    setDialogOpen(false);
    fetchTodos();
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !completed }),
    });
    fetchTodos();
  };

  const deleteTodo = async (id: string) => {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    fetchTodos();
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
    }
  };

  if (!isReady) return null;

  const urgentTodos = todos.filter((t) => t.priority === "URGENT");
  const plannedTodos = todos.filter((t) => t.priority === "PLANNED");

  const renderTodoList = (items: Todo[]) => {
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
                <p className="text-sm font-medium">{todo.title}</p>
                {todo.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {todo.description}
                  </p>
                )}
                {todo.dueDate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(todo.dueDate).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteTodo(todo.id)}
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
              Termines ({done.length})
            </p>
            {done.map((todo) => (
              <Card key={todo.id} className="opacity-50 mb-2">
                <CardContent className="flex items-center gap-3 p-4">
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
                  />
                  <p className="text-sm line-through flex-1">{todo.title}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTodo(todo.id)}
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
            Aucune tache. Profite !
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes taches</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle tache
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une tache</DialogTitle>
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
                  placeholder="Details..."
                />
              </div>
              <div>
                <Label>Priorite</Label>
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
                    Planifie
                  </Button>
                </div>
              </div>
              {newTodo.priority === "PLANNED" && (
                <>
                  <div>
                    <Label>Date d&apos;echeance</Label>
                    <Input
                      type="datetime-local"
                      value={newTodo.dueDate}
                      onChange={(e) =>
                        setNewTodo({ ...newTodo, dueDate: e.target.value })
                      }
                    />
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

      {/* Quick add */}
      <Input
        placeholder="Ajout rapide (Entree pour ajouter en urgent)..."
        value={quickAdd}
        onChange={(e) => setQuickAdd(e.target.value)}
        onKeyDown={handleQuickAdd}
      />

      <Tabs defaultValue="urgent">
        <TabsList>
          <TabsTrigger value="urgent" className="gap-1">
            <AlertCircle className="h-4 w-4" />
            Urgent ({urgentTodos.filter((t) => !t.completed).length})
          </TabsTrigger>
          <TabsTrigger value="planned" className="gap-1">
            <Calendar className="h-4 w-4" />
            Planifie ({plannedTodos.filter((t) => !t.completed).length})
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
