"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addWeeks, format, isToday, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Heart, Plus, ShoppingCart, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TOAST_ACTION_DURATION, useFeedback } from "@/components/ui/feedback";
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
  const [shopping, setShopping] = useState<"idle" | "busy" | "done">("idle");
  const { toast, dismiss, confirm } = useFeedback();
  const router = useRouter();
  const pendingDeletes = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; toastId: number }>());
  const todayRef = useRef<HTMLDivElement>(null);
  // Clavier du téléphone : pas d'autofocus sur la recherche sans souris.
  const [canHover, setCanHover] = useState(false);
  useEffect(() => setCanHover(window.matchMedia("(hover: hover)").matches), []);

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
    setShopping("idle");
  }, [fetchEntries]);

  // Retraits en attente : envoyés si on quitte la page avant la fin du délai d'annulation.
  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      pending.forEach(({ timer, toastId }, id) => {
        clearTimeout(timer);
        dismiss(toastId);
        fetch(`/api/meals/${id}`, { method: "DELETE", keepalive: true }).catch(() => {});
      });
    };
  }, [dismiss]);

  // Semaine en cours sur téléphone : aller directement au jour d'aujourd'hui.
  const isCurrentWeek = day(weekStart) === day(startOfWeek(new Date(), WEEK));
  useEffect(() => {
    if (isCurrentWeek && window.matchMedia("(max-width: 639px)").matches) {
      todayRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [isCurrentWeek]);

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
    if (!res.ok) {
      toast("Le repas n'a pas pu être ajouté.", "error");
      return;
    }
    const entry: MealEntry = await res.json();
    setEntries((prev) => [...prev, entry]);
    setPicker(null);
  };

  // Retrait immédiat à l'écran, suppression après le délai d'annulation.
  const remove = (entry: MealEntry) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(entry.id);
      const res = await fetch(`/api/meals/${entry.id}`, { method: "DELETE" }).catch(() => null);
      if (!res?.ok) {
        setEntries((prev) => [...prev, entry]);
        toast("Le repas n'a pas pu être retiré.", "error");
      }
    }, TOAST_ACTION_DURATION);
    const toastId = toast(`« ${entry.recipe?.title ?? entry.note} » retiré`, "info", {
      label: "Annuler",
      onClick: () => {
        clearTimeout(pendingDeletes.current.get(entry.id)?.timer);
        pendingDeletes.current.delete(entry.id);
        setEntries((prev) => [...prev, entry]);
      },
    });
    pendingDeletes.current.set(entry.id, { timer, toastId });
  };

  const makeShoppingList = async () => {
    if (
      shopping === "done" &&
      !(await confirm({
        title: "Ajouter encore les ingrédients ?",
        description: "Ils ont déjà été ajoutés à une liste pour cette semaine.",
        confirmLabel: "Ajouter",
      }))
    ) {
      return;
    }
    setShopping("busy");
    const res = await fetch("/api/meals/to-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, groupId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setShopping("idle");
      toast(data.error ?? "Impossible de créer la liste.", "error");
      return;
    }
    setShopping("done");
    const plural = data.added > 1 ? "s" : "";
    toast(`${data.added} ingrédient${plural} ajouté${plural} pour ${data.meals} repas.`, "success", {
      label: "Voir la liste",
      onClick: () => router.push("/lists"),
    });
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
        <Button onClick={makeShoppingList} disabled={recipeMeals === 0 || shopping === "busy"}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Courses de la semaine
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d) => {
          const date = day(d);
          return (
            <div
              key={date}
              ref={isToday(d) ? todayRef : undefined}
              className={cn("rounded-xl border p-3 space-y-3 scroll-mt-20", isToday(d) ? "border-primary bg-primary/5" : "border-border bg-card")}
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
                          onClick={() => remove(e)}
                          className="p-1 touch:p-2 -m-0.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover/meal:opacity-100 focus:opacity-100 touch:opacity-100 transition-opacity"
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
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Ajouter
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
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher une recette…"
              autoFocus={canHover}
            />
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
