"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { nativeHaptic } from "@/lib/native";
import { fillMatchCart, useMatchDriveAvailable } from "@/lib/matchDrive";
import { useGroupContext } from "@/components/GroupContext";
import { useDeferredDelete } from "@/lib/useDeferredDelete";
import {
  applyOps,
  flushPendingOps,
  newItemId,
  onPendingOpsChange,
  pendingOps,
  runListOp,
  type ListOp,
  type NewItem,
} from "@/lib/offlineLists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedList, SegmentedTrigger } from "@/components/ui/segmented";
import { ModuleHero, HeroChip, HeroIconButton } from "@/components/ui/module-hero";
import { CheckCircle } from "@/components/ui/check-circle";
import { SwipeRow } from "@/components/ui/swipe-row";
import { FlipList } from "@/components/ui/flip-list";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  ShoppingCart,
  Globe,
  ExternalLink,
  ChefHat,
  CookingPot,
  Check,
  ChevronDown,
  ChevronUp,
  Tag,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useFeedback } from "@/components/ui/feedback";

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  checked: boolean;
  category: string | null;
  url: string | null;
  price: number | null;
  store: string | null;
  recipeId: string | null;
  recipe: { id: string; title: string } | null;
}

interface ShoppingList {
  id: string;
  name: string;
  type: "GROCERY" | "ONLINE";
  items: ShoppingItem[];
}

interface Recipe {
  id: string;
  title: string;
  ingredientCount: number;
}

interface GroupedItem {
  key: string;
  name: string;
  items: ShoppingItem[];
  totalQty: string;
  recipes: { id: string; title: string }[];
}

function normalizeKey(name: string): string {
  return name.toLowerCase().trim()
    .replace(/s$/, "")
    .replace(/^(de |d'|l'|le |la |les |du |des )/, "");
}

function combineQuantities(items: ShoppingItem[]): string {
  const parts = items
    .map((i) => i.quantity)
    .filter((q): q is string => !!q);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.join(" + ");
}

// Article ajouté hors ligne, affiché avant que le serveur ne l'ait reçu.
function localItem(item: NewItem): ShoppingItem {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    checked: false,
    category: null,
    url: item.url ?? null,
    price: item.price ?? null,
    store: item.store ?? null,
    recipeId: null,
    recipe: null,
  };
}

function withPending(lists: ShoppingList[]): ShoppingList[] {
  return applyOps(lists, pendingOps(), localItem);
}

/** Connexion et nombre de modifications de listes pas encore envoyées. */
function useOfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setPending(pendingOps().length);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const unsubscribe = onPendingOpsChange(update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      unsubscribe();
    };
  }, []);

  return { online, pending };
}

function groupItems(items: ShoppingItem[]): GroupedItem[] {
  const map = new Map<string, GroupedItem>();
  for (const item of items) {
    const key = normalizeKey(item.name);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: item.name,
        items: [],
        totalQty: "",
        recipes: [],
      });
    }
    const group = map.get(key)!;
    group.items.push(item);
    if (item.recipe && !group.recipes.some((r) => r.id === item.recipe!.id)) {
      group.recipes.push(item.recipe);
    }
  }
  const result = Array.from(map.values());
  result.forEach((group) => {
    group.totalQty = combineQuantities(group.items);
  });
  return result;
}

export default function ListsPage() {
  const { isReady } = useAuth();
  const { currentGroupId } = useGroupContext();
  const { toast } = useFeedback();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newList, setNewList] = useState({ name: "", type: "GROCERY" as "GROCERY" | "ONLINE" });
  const { online, pending } = useOfflineStatus();
  // Suppression de liste avec annulation : la liste est masquée tout de suite,
  // la requête DELETE part à la fin du délai (comme pour les tâches).
  const { hidden: hiddenLists, requestDelete } = useDeferredDelete();

  // Hors ligne, /api/lists vient du cache du service worker (src/app/sw.ts) :
  // on y rejoue les modifications en attente pour ne pas les faire disparaître.
  const fetchLists = useCallback(() => {
    // Réponse en erreur (groupe enregistré invalide, etc.) : on garde les
    // listes précédentes plutôt que d'écraser l'état avec l'objet d'erreur.
    fetch("/api/lists")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ShoppingList[] | null) => {
        if (data) setLists(withPending(data));
      })
      .catch(() => {})
      .finally(() => setLoadedOnce(true));
  }, []);

  const fetchRecipes = useCallback(() => {
    // Le choix « ajouter une recette » n'affiche que le titre et le nombre
    // d'ingrédients : inutile de charger les recettes complètes.
    fetch("/api/recipes?fields=summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setRecipes(data);
      })
      .catch(() => {});
  }, []);

  // Envoie les modifications en attente, puis recharge depuis le serveur.
  const sync = useCallback(async () => {
    if (await flushPendingOps()) fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    if (isReady) {
      fetchLists();
      fetchRecipes();
      sync();
    }
  }, [isReady, fetchLists, fetchRecipes, sync]);

  // Retour du réseau ou de l'app au premier plan : on retente l'envoi.
  useEffect(() => {
    if (!isReady) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isReady, sync]);

  // Applique les opérations à l'écran tout de suite, puis les envoie (ou les
  // met en file hors ligne). On ne recharge que si tout est parti : sinon le
  // serveur, ou son cache, ne connaît pas encore ces modifications.
  const runOps = async (ops: ListOp[]) => {
    setLists((current) => applyOps(current, ops, localItem));
    const results = await Promise.all(ops.map(runListOp));
    if (!results.includes("queued")) fetchLists();
  };

  const createList = async () => {
    if (!newList.name.trim()) return;
    await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Rattachée au groupe courant : partagée avec tous ses membres.
      body: JSON.stringify({ ...newList, groupId: currentGroupId }),
    });
    setNewList({ name: "", type: "GROCERY" });
    setDialogOpen(false);
    fetchLists();
  };

  const deleteList = (list: ShoppingList) => {
    requestDelete({
      id: list.id,
      url: `/api/lists/${list.id}`,
      confirmMessage: `« ${list.name} » supprimée`,
      errorMessage: "La liste n'a pas pu être supprimée.",
      refresh: fetchLists,
    });
  };

  const addItem = (listId: string, item: Omit<NewItem, "id">) =>
    runOps([{ type: "add", listId, item: { ...item, id: newItemId() } }]);

  const addRecipeToList = async (listId: string, recipeId: string) => {
    await fetch(`/api/recipes/${recipeId}/to-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId }),
    });
    fetchLists();
  };

  const toggleItem = (listId: string, itemId: string, checked: boolean) => {
    if (!checked) nativeHaptic();
    return runOps([{ type: "check", listId, itemId, checked: !checked }]);
  };

  const toggleGroup = (listId: string, items: ShoppingItem[]) => {
    const checked = !items[0].checked;
    if (checked) nativeHaptic();
    return runOps(items.map((item) => ({ type: "check", listId, itemId: item.id, checked })));
  };

  const deleteGroup = (listId: string, items: ShoppingItem[]) =>
    runOps(items.map((item) => ({ type: "delete", listId, itemId: item.id })));

  const deleteItem = (listId: string, itemId: string) =>
    runOps([{ type: "delete", listId, itemId }]);

  if (!isReady) return null;

  const visibleLists = lists.filter((l) => !hiddenLists.has(l.id));
  const groceryLists = visibleLists.filter((l) => l.type === "GROCERY");
  const onlineLists = visibleLists.filter((l) => l.type === "ONLINE");
  const toBuy = groceryLists.reduce((n, l) => n + l.items.filter((i) => !i.checked).length, 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 md:mx-0">
      <ModuleHero
        tone="list"
        title="Listes"
        count={lists.length === 0 && !loadedOnce ? null : toBuy}
        countLabel={toBuy > 1 ? "articles à prendre" : "article à prendre"}
        kicker={toBuy === 0 && lists.length > 0 ? "Tout est dans le chariot" : undefined}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <HeroIconButton
                disabled={!online}
                aria-label="Nouvelle liste"
                title="Nouvelle liste"
                className="bg-on-tone text-tone-list hover:bg-on-tone/90 disabled:opacity-50"
              >
                <Plus className="h-6 w-6" strokeWidth={3} />
              </HeroIconButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une liste</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lists-nom">Nom</Label>
                  <Input id="lists-nom"
                    value={newList.name}
                    onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                    placeholder="Ex. : courses de la semaine, idées cadeaux…"
                  />
                </div>
                <div>
                  <Label id="list-type">Type</Label>
                  <div className="flex gap-2 mt-1" role="group" aria-labelledby="list-type">
                    <Button
                      type="button"
                      variant={newList.type === "GROCERY" ? "default" : "outline"}
                      size="sm"
                      aria-pressed={newList.type === "GROCERY"}
                      onClick={() => setNewList({ ...newList, type: "GROCERY" })}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Courses
                    </Button>
                    <Button
                      type="button"
                      variant={newList.type === "ONLINE" ? "default" : "outline"}
                      size="sm"
                      aria-pressed={newList.type === "ONLINE"}
                      onClick={() => setNewList({ ...newList, type: "ONLINE" })}
                    >
                      <Globe className="h-4 w-4 mr-1" />
                      Achats en ligne
                    </Button>
                  </div>
                </div>
                <Button className="w-full" onClick={createList}>
                  Créer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        <OfflineStatus online={online} pending={pending} onRetry={sync} />
      </ModuleHero>

      <Tabs defaultValue="grocery">
        <SegmentedList>
          <SegmentedTrigger value="grocery" tone="list" icon={<ShoppingCart className="h-4 w-4" />} count={groceryLists.length}>
            Courses
          </SegmentedTrigger>
          <SegmentedTrigger value="online" tone="list" icon={<Globe className="h-4 w-4" />} count={onlineLists.length}>
            En ligne
          </SegmentedTrigger>
        </SegmentedList>

        <TabsContent value="grocery" className="mt-4">
          <ListGroup
            lists={groceryLists}
            type="GROCERY"
            onCreate={() => { setNewList((n) => ({ ...n, type: "GROCERY" })); setDialogOpen(true); }}
            recipes={recipes}
            online={online}
            onAddItem={addItem}
            onAddRecipeToList={addRecipeToList}
            onToggleGroup={toggleGroup}
            onToggleItem={toggleItem}
            onDeleteGroup={deleteGroup}
            onDeleteItem={deleteItem}
            onDeleteList={deleteList}
          />
        </TabsContent>

        <TabsContent value="online" className="mt-4">
          <ListGroup
            lists={onlineLists}
            type="ONLINE"
            onCreate={() => { setNewList((n) => ({ ...n, type: "ONLINE" })); setDialogOpen(true); }}
            recipes={recipes}
            online={online}
            onAddItem={addItem}
            onAddRecipeToList={addRecipeToList}
            onToggleGroup={toggleGroup}
            onToggleItem={toggleItem}
            onDeleteGroup={deleteGroup}
            onDeleteItem={deleteItem}
            onDeleteList={deleteList}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Offline status ───────────────────────────────────────── */

function OfflineStatus({
  online,
  pending,
  onRetry,
}: {
  online: boolean;
  pending: number;
  onRetry: () => void;
}) {
  if (online && pending === 0) return null;
  const content = (
    <>
      {online ? <RefreshCw className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {online ? "Envoi en attente" : "Hors ligne"}
      {pending > 0 && ` · ${pending} modification${pending > 1 ? "s" : ""}`}
    </>
  );
  // En ligne avec des modifications en attente : un envoi a échoué, on peut relancer.
  return online ? (
    <button type="button" className="inline-flex" onClick={onRetry} title="Renvoyer">
      <HeroChip className="min-h-11 whitespace-nowrap">{content}</HeroChip>
    </button>
  ) : (
    <HeroChip className="whitespace-nowrap">{content}</HeroChip>
  );
}

/* ── Ajout d'un article : toujours sous la main ───────────── */

function AddItemRow({
  type,
  onAdd,
}: {
  type: "GROCERY" | "ONLINE";
  onAdd: (item: Omit<NewItem, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!name.trim()) return;
    const item: Omit<NewItem, "id"> = { name, quantity: quantity || null };
    if (type === "ONLINE") {
      item.url = url || null;
      item.price = price ? Number(price) : null;
      item.store = store || null;
    }
    onAdd(item);
    setName("");
    setQuantity("");
    setUrl("");
    setPrice("");
    setStore("");
    // On enchaîne : le champ garde le focus pour l'article suivant.
    nameInput.current?.focus();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-2 p-3"
    >
      <div className="flex h-16 items-center gap-2 rounded-full bg-ink pl-6 pr-2 text-ink-foreground focus-within:ring-[3px] focus-within:ring-ring/70">
        <input
          ref={nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un article…"
          aria-label="Article"
          enterKeyHint="done"
          className="h-full min-w-0 flex-1 bg-transparent text-[1.0625rem] font-medium outline-none placeholder:text-ink-foreground/60"
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qté"
          aria-label="Quantité"
          enterKeyHint="done"
          className="h-10 w-16 shrink-0 rounded-full bg-ink-foreground/10 px-3 text-center text-base font-semibold outline-none placeholder:text-ink-foreground/60 focus:bg-ink-foreground/20"
        />
        <button
          type="submit"
          aria-label="Ajouter"
          disabled={!name.trim()}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-150 active:scale-90",
            name.trim() ? "bg-tone-list text-on-tone" : "bg-ink-foreground/15 text-ink-foreground/60"
          )}
        >
          <Plus className="h-6 w-6" strokeWidth={3} />
        </button>
      </div>
      {type === "ONLINE" && (
        <div className="flex flex-wrap gap-2">
          <Input placeholder="URL" aria-label="Lien" value={url} onChange={(e) => setUrl(e.target.value)} className="h-12 min-w-[10rem] flex-1 rounded-full px-4" />
          <Input placeholder="Prix" aria-label="Prix" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 w-24 rounded-full px-4" />
          <Input placeholder="Magasin" aria-label="Magasin" value={store} onChange={(e) => setStore(e.target.value)} className="h-12 w-32 rounded-full px-4" />
        </div>
      )}
    </form>
  );
}

/* ── List Group ───────────────────────────────────────────── */

function ListGroup({
  lists,
  type,
  onCreate,
  recipes,
  online,
  onAddItem,
  onAddRecipeToList,
  onToggleGroup,
  onToggleItem,
  onDeleteGroup,
  onDeleteItem,
  onDeleteList,
}: {
  lists: ShoppingList[];
  type: "GROCERY" | "ONLINE";
  onCreate: () => void;
  recipes: Recipe[];
  online: boolean;
  onAddItem: (listId: string, item: Omit<NewItem, "id">) => void;
  onAddRecipeToList: (listId: string, recipeId: string) => void;
  onToggleGroup: (listId: string, items: ShoppingItem[]) => void;
  onToggleItem: (listId: string, itemId: string, checked: boolean) => void;
  onDeleteGroup: (listId: string, items: ShoppingItem[]) => void;
  onDeleteItem: (listId: string, itemId: string) => void;
  onDeleteList: (list: ShoppingList) => void;
}) {
  const [showRecipeTags, setShowRecipeTags] = useState(false);
  // Dans l'app seulement : remplir le panier drive Match depuis la liste.
  const matchDrive = useMatchDriveAvailable();

  if (lists.length === 0) {
    return (
      <EmptyState
        icon={type === "GROCERY" ? ShoppingCart : Globe}
        tone="list"
        title={type === "GROCERY" ? "Pas encore de liste de courses." : "Pas encore d’achats en ligne."}
        action={
          <Button onClick={onCreate} className="h-12 rounded-full px-6 text-base font-bold">
            <Plus className="mr-1.5 h-5 w-5" strokeWidth={3} />
            Créer une liste
          </Button>
        }
      >
        {type === "GROCERY"
          ? "Crée-la ici, ou génère-la depuis une recette."
          : "Idées cadeaux, articles à comparer : garde le lien, le prix et le magasin."}
      </EmptyState>
    );
  }

  const headBtn =
    "flex h-12 w-12 items-center justify-center rounded-full transition-[transform,background-color] hover:bg-on-tone/[0.14] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tone";

  return (
    <div className="space-y-5">
      {lists.map((list) => {
        const unchecked = list.items.filter((i) => !i.checked);
        const checked = list.items.filter((i) => i.checked);
        const total = list.items.reduce((sum, i) => sum + (i.price || 0), 0);
        const grouped = groupItems(unchecked);
        const checkedGrouped = groupItems(checked);
        const uniqueCount = grouped.length;
        const checkedUniqueCount = checkedGrouped.length;
        const progress = (uniqueCount + checkedUniqueCount) > 0
          ? Math.round((checkedUniqueCount / (uniqueCount + checkedUniqueCount)) * 100)
          : 0;
        const hasRecipeItems = unchecked.some((i) => i.recipeId);

        return (
          <div key={list.id} className="overflow-hidden rounded-[2rem] bg-card shadow-surface">
            {/* En-tête à l'aplat vert */}
            <div className="flex items-center gap-3 bg-tone-list py-4 pl-4 pr-2 text-on-tone">
              {list.items.length > 0 && (
                <ProgressRing value={progress / 100} size={56}>
                  {checkedUniqueCount}/{uniqueCount + checkedUniqueCount}
                </ProgressRing>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-display line-clamp-2 break-words text-[1.5rem] leading-[1.02]">{list.name}</h2>
                {list.items.length > 0 && (
                  <p className="mt-0.5 text-sm font-bold tabular-nums">
                    {uniqueCount > 0 ? `${uniqueCount} ${uniqueCount > 1 ? "articles" : "article"} à prendre` : "Tout est pris"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center">
                {type === "ONLINE" && total > 0 && (
                  <span className="mr-2 text-sm font-extrabold tabular-nums">
                    {total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                  </span>
                )}
                {matchDrive && online && type === "GROCERY" && unchecked.length > 0 && (
                  <button
                    className={headBtn}
                    title="Remplir mon panier Match"
                    aria-label="Remplir mon panier Match"
                    onClick={() => fillMatchCart(list.id)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </button>
                )}
                {online && type === "GROCERY" && recipes.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className={headBtn} title="Ajouter une recette" aria-label="Ajouter une recette">
                        <CookingPot className="h-4 w-4" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ajouter les ingrédients d&apos;une recette</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2">
                        {recipes.map((recipe) => (
                          <DialogClose key={recipe.id} asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => onAddRecipeToList(list.id, recipe.id)}
                            >
                              <ChefHat className="h-4 w-4 mr-2 shrink-0" />
                              <span className="truncate">{recipe.title}</span>
                              <span className="text-xs text-muted-foreground ml-auto pl-2">
                                {recipe.ingredientCount} ing.
                              </span>
                            </Button>
                          </DialogClose>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {hasRecipeItems && (
                  <button
                    className={cn(headBtn, showRecipeTags && "bg-on-tone/[0.18]")}
                    onClick={() => setShowRecipeTags(!showRecipeTags)}
                    title={showRecipeTags ? "Masquer les recettes" : "Voir les recettes"}
                    aria-label={showRecipeTags ? "Masquer les recettes" : "Voir les recettes"}
                    aria-pressed={showRecipeTags}
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                )}
                {online && (
                  <button
                    className={cn(headBtn, "ml-1 hover:bg-destructive hover:text-destructive-foreground")}
                    onClick={() => onDeleteList(list)}
                    title="Supprimer la liste"
                    aria-label={`Supprimer la liste « ${list.name} »`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Articles à prendre (regroupés) */}
            <FlipList signature={grouped.map((g) => g.key).join(",")} className="px-2 pt-2">
              {grouped.map((group) => (
                <GroceryRow
                  key={group.key}
                  group={group}
                  listId={list.id}
                  showRecipe={showRecipeTags}
                  onToggle={onToggleGroup}
                  onDelete={onDeleteGroup}
                />
              ))}
            </FlipList>

            {list.items.length === 0 && (
              <p className="py-6 text-center text-base font-semibold text-muted-foreground">Liste vide</p>
            )}

            <AddItemRow type={type} onAdd={(item) => onAddItem(list.id, item)} />

            {/* Articles pris */}
            {checkedGrouped.length > 0 && (
              <CheckedSection
                groups={checkedGrouped}
                listId={list.id}
                showRecipe={showRecipeTags}
                onToggle={onToggleGroup}
                onDelete={onDeleteGroup}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Grouped Grocery Row ──────────────────────────────────── */

function GroceryRow({
  group,
  listId,
  showRecipe,
  onToggle,
  onDelete,
}: {
  group: GroupedItem;
  listId: string;
  showRecipe: boolean;
  onToggle: (listId: string, items: ShoppingItem[]) => void;
  onDelete: (listId: string, items: ShoppingItem[]) => void;
}) {
  return (
    <SwipeRow
      data-flip={group.key}
      tone="list"
      className="rounded-[1.25rem]"
      frontClassName="group/card flex min-h-16 items-center gap-1 bg-card pl-1 pr-1 transition-colors hover:bg-accent/40"
      onSwipeRight={() => onToggle(listId, group.items)}
    >
      <CheckCircle
        tone="list"
        checked={false}
        onCheckedChange={() => onToggle(listId, group.items)}
        aria-label={`Cocher ${group.name}`}
      />

      <div className="min-w-0 flex-1 py-2.5 pl-1">
        <span className="block text-[1.0625rem] font-bold leading-snug">{group.name}</span>
        {showRecipe && group.recipes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {group.recipes.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-tone-list-soft px-2 py-0.5 text-xs font-bold text-tone-list-ink">
                <ChefHat className="h-3 w-3" />
                {r.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {group.totalQty && (
        <span className="shrink-0 rounded-full bg-tone-list-soft px-3 py-1 text-sm font-extrabold tabular-nums text-tone-list-ink">
          {group.totalQty}
        </span>
      )}

      {group.items.some((i) => i.url) && (
        <a
          href={group.items.find((i) => i.url)!.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover/card:opacity-100 focus-visible:opacity-100 touch:opacity-100"
          title="Ouvrir le lien"
          aria-label="Ouvrir le lien"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      <button
        aria-label="Supprimer l'article"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover/card:opacity-100 focus-visible:opacity-100 touch:opacity-100"
        onClick={() => onDelete(listId, group.items)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </SwipeRow>
  );
}

/* ── Checked Items (collapsible) ──────────────────────────── */

function CheckedSection({
  groups,
  listId,
  showRecipe,
  onToggle,
  onDelete,
}: {
  groups: GroupedItem[];
  listId: string;
  showRecipe: boolean;
  onToggle: (listId: string, items: ShoppingItem[]) => void;
  onDelete: (listId: string, items: ShoppingItem[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-border/60 bg-tone-list-soft/50 px-2 pb-2">
      <button
        className="flex h-14 w-full items-center gap-2 rounded-full px-3 text-base font-extrabold text-tone-list-ink transition-colors hover:bg-tone-list-soft"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
        <span>Dans le chariot ({groups.length})</span>
        {expanded ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
      </button>
      {expanded && (
        <FlipList signature={groups.map((g) => g.key).join(",")}>
          {groups.map((group) => (
            <div key={group.key} data-flip={group.key} className="group/card flex min-h-14 items-center gap-1 rounded-[1.25rem] pl-1 pr-1 hover:bg-tone-list-soft">
              <CheckCircle
                tone="list"
                checked
                onCheckedChange={() => onToggle(listId, group.items)}
                aria-label={`Décocher ${group.name}`}
              />
              <span className="min-w-0 flex-1 pl-1 text-base font-semibold text-muted-foreground">
                <span className="strike" data-done="true">{group.name}</span>
              </span>
              {group.totalQty && <span className="text-sm font-bold text-muted-foreground">{group.totalQty}</span>}
              {showRecipe && group.recipes.length > 0 && (
                <div className="flex gap-1">
                  {group.recipes.map((r) => (
                    <span key={r.id} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
                      {r.title}
                    </span>
                  ))}
                </div>
              )}
              <button
                aria-label="Supprimer l'article"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover/card:opacity-100 focus-visible:opacity-100 touch:opacity-100"
                onClick={() => onDelete(listId, group.items)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </FlipList>
      )}
    </div>
  );
}
