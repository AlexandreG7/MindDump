"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addWeeks, format, isToday, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Heart, Plus, ShoppingCart, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MEAL_SLOTS, type MealSlot } from "@/lib/meals";

export interface PlannerRecipe {
  id: string;
  title: string;
  image: string | null;
  planned: boolean;
  favorite?: boolean;
}

interface MealEntry {
  id: string;
  date: string;
  slot: MealSlot;
  note: string | null;
  servings: number | null;
  recipe: { id: string; title: string; image: string | null } | null;
}

const WEEK = { weekStartsOn: 1 as const };
const day = (d: Date) => format(d, "yyyy-MM-dd");

/** Planning des repas de la semaine : midi et soir, recettes ou simples notes. */
export function MealPlanner({
  recipes,
  groupId,
  onOpenRecipe,
}: {
  recipes: PlannerRecipe[];
  groupId: string | null;
  onOpenRecipe?: (id: string) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), WEEK));
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [picker, setPicker] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [shopping, setShopping] = useState<{ status: "idle" | "busy" | "done" | "error"; message?: string }>({
    status: "idle",
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = day(days[0]);
  const to = day(days[6]);

  const fetchEntries = useCallback(() => {
    const params = new URLSearchParams({ from, to, ...(groupId ? { groupId } : {}) });
    fetch(`/api/meals?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => {});
  }, [from, to, groupId]);

  useEffect(() => {
    fetchEntries();
    setShopping({ status: "idle" });
  }, [fetchEntries]);

  const openPicker = (date: string, slot: MealSlot) => {
    setPicker({ date, slot });
    setQuery("");
    setNote("");
  };

  const add = async (payload: { recipeId?: string; note?: string }) => {
    if (!picker) return;
    const res = await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...picker, ...payload, groupId }),
    });
    if (res.ok) {
      const entry: MealEntry = await res.json();
      setEntries((prev) => [...prev, entry]);
    }
    setPicker(null);
  };

  const remove = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/meals/${id}`, { method: "DELETE" });
  };

  const makeShoppingList = async () => {
    setShopping({ status: "busy" });
    const res = await fetch("/api/meals/to-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, groupId }),
    });
    const data = await res.json().catch(() => ({}));
    setShopping(
      res.ok
        ? { status: "done", message: `${data.added} ingrédient${data.added > 1 ? "s" : ""} ajouté${data.added > 1 ? "s" : ""} pour ${data.meals} repas.` }
        : { status: "error", message: data.error ?? "Impossible de créer la liste." }
    );
  };

  // Favoris puis recettes prévues d'abord : ce sont les candidates naturelles.
  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...recipes]
      .filter((r) => !q || r.title.toLowerCase().includes(q))
      .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || Number(b.planned) - Number(a.planned) || a.title.localeCompare(b.title, "fr"))
      .slice(0, 30);
  }, [recipes, query]);

  const recipeMeals = entries.filter((e) => e.recipe).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, -1))} aria-label="Semaine précédente">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))} aria-label="Semaine suivante">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" className="ml-1" onClick={() => setWeekStart(startOfWeek(new Date(), WEEK))}>
            Cette semaine
          </Button>
          <h2 className="ml-2 font-semibold">
            {format(days[0], "d MMM", { locale: fr })} – {format(days[6], "d MMM yyyy", { locale: fr })}
          </h2>
        </div>
        <Button onClick={makeShoppingList} disabled={recipeMeals === 0 || shopping.status === "busy"}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Courses de la semaine
        </Button>
      </div>

      {shopping.message && (
        <p className={cn("text-sm", shopping.status === "error" ? "text-destructive" : "text-muted-foreground")}>
          {shopping.message}{" "}
          {shopping.status === "done" && (
            <Link href="/lists" className="font-medium text-primary hover:underline">
              Voir la liste
            </Link>
          )}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d) => {
          const date = day(d);
          return (
            <div
              key={date}
              className={cn("rounded-xl border p-3 space-y-3", isToday(d) ? "border-primary bg-primary/5" : "border-border bg-card")}
            >
              <p className={cn("text-sm font-semibold first-letter:uppercase", isToday(d) && "text-primary")}>
                {format(d, "EEEE d", { locale: fr })}
              </p>
              {MEAL_SLOTS.map((slot) => {
                const slotEntries = entries.filter((e) => e.date === date && e.slot === slot.value);
                return (
                  <div key={slot.value} className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{slot.label}</p>
                    {slotEntries.map((e) => (
                      <div key={e.id} className="group/meal flex items-start gap-1 rounded-lg bg-secondary/60 px-2 py-1.5">
                        {e.recipe ? (
                          <button
                            onClick={() => onOpenRecipe?.(e.recipe!.id)}
                            className="min-w-0 flex-1 text-left text-sm leading-tight line-clamp-3 hover:underline"
                          >
                            {e.recipe.title}
                          </button>
                        ) : (
                            <span className="flex items-start gap-1.5 flex-1 min-w-0 text-sm italic text-muted-foreground">
                            <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
                            <span className="line-clamp-2">{e.note}</span>
                          </span>
                        )}
                        <button
                          onClick={() => remove(e.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover/meal:opacity-100 focus:opacity-100 touch:opacity-100 transition-opacity"
                          aria-label={`Retirer ${e.recipe?.title ?? e.note} du ${slot.label.toLowerCase()}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => openPicker(date, slot.value)}
                      className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 touch:py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      aria-label={`Ajouter un repas le ${format(d, "EEEE d", { locale: fr })}, ${slot.label.toLowerCase()}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <Dialog open={!!picker} onOpenChange={(open) => !open && setPicker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="first-letter:uppercase">
              {picker &&
                `${format(new Date(`${picker.date}T12:00:00`), "EEEE d MMMM", { locale: fr })} · ${
                  MEAL_SLOTS.find((s) => s.value === picker.slot)?.label.toLowerCase()
                }`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher une recette…" autoFocus />
            <ul className="max-h-72 overflow-y-auto -mx-1">
              {choices.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => add({ recipeId: r.id })}
                    className="w-full flex items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-secondary transition-colors"
                  >
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
                    ) : (
                      <span className="w-10 h-10 rounded-md bg-muted shrink-0" />
                    )}
                    <span className="flex-1 text-sm">{r.title}</span>
                    {r.favorite && <Heart className="h-3.5 w-3.5 text-primary fill-current" aria-label="Favori" />}
                  </button>
                </li>
              ))}
              {choices.length === 0 && (
                <li className="text-sm text-muted-foreground px-1 py-2">Aucune recette ne correspond.</li>
              )}
            </ul>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && note.trim() && add({ note })}
                placeholder="Ou une note : restes, resto, pique-nique…"
                maxLength={120}
              />
              <Button variant="outline" onClick={() => add({ note })} disabled={!note.trim()}>
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
