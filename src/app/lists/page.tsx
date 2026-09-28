"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGroupContext } from "@/components/GroupContext";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ingredients: { id: string; name: string; quantity: string; unit: string | null }[];
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
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newList, setNewList] = useState({ name: "", type: "GROCERY" as "GROCERY" | "ONLINE" });
  const { online, pending } = useOfflineStatus();

  // Hors ligne, /api/lists vient du cache du service worker (src/app/sw.ts) :
  // on y rejoue les modifications en attente pour ne pas les faire disparaître.
  const fetchLists = useCallback(() => {
    fetch("/api/lists")
      .then((r) => r.json())
      .then((data: ShoppingList[]) => setLists(withPending(data)))
      .catch(() => {});
  }, []);

  const fetchRecipes = useCallback(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes)
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

  const deleteList = async (id: string) => {
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    fetchLists();
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

  const toggleItem = (listId: string, itemId: string, checked: boolean) =>
    runOps([{ type: "check", listId, itemId, checked: !checked }]);

  const toggleGroup = (listId: string, items: ShoppingItem[]) => {
    const checked = !items[0].checked;
    return runOps(items.map((item) => ({ type: "check", listId, itemId: item.id, checked })));
  };

  const deleteGroup = (listId: string, items: ShoppingItem[]) =>
    runOps(items.map((item) => ({ type: "delete", listId, itemId: item.id })));

  const deleteItem = (listId: string, itemId: string) =>
    runOps([{ type: "delete", listId, itemId }]);

  if (!isReady) return null;

  const groceryLists = lists.filter((l) => l.type === "GROCERY");
  const onlineLists = lists.filter((l) => l.type === "ONLINE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Mes listes</h1>
          <OfflineStatus online={online} pending={pending} onRetry={sync} />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!online}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle liste
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une liste</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input
                  value={newList.name}
                  onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                  placeholder="Ex. : courses de la semaine, idées cadeaux…"
                />
              </div>
              <div>
                <Label>Type</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={newList.type === "GROCERY" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewList({ ...newList, type: "GROCERY" })}
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Courses
                  </Button>
                  <Button
                    type="button"
                    variant={newList.type === "ONLINE" ? "default" : "outline"}
                    size="sm"
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
      </div>

      <Tabs defaultValue="grocery">
        <TabsList>
          <TabsTrigger value="grocery" className="gap-1">
            <ShoppingCart className="h-4 w-4" />
            Courses ({groceryLists.length})
          </TabsTrigger>
          <TabsTrigger value="online" className="gap-1">
            <Globe className="h-4 w-4" />
            En ligne ({onlineLists.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grocery">
          <ListGroup
            lists={groceryLists}
            type="GROCERY"
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

        <TabsContent value="online">
          <ListGroup
            lists={onlineLists}
            type="ONLINE"
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
  const className = "mt-1 flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap";
  // En ligne avec des modifications en attente : un envoi a échoué, on peut relancer.
  return online ? (
    <button className={`${className} hover:text-foreground`} onClick={onRetry} title="Renvoyer">
      {content}
    </button>
  ) : (
    <span className={className}>{content}</span>
  );
}

/* ── List Group ───────────────────────────────────────────── */

function ListGroup({
  lists,
  type,
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
  recipes: Recipe[];
  online: boolean;
  onAddItem: (listId: string, item: Omit<NewItem, "id">) => void;
  onAddRecipeToList: (listId: string, recipeId: string) => void;
  onToggleGroup: (listId: string, items: ShoppingItem[]) => void;
  onToggleItem: (listId: string, itemId: string, checked: boolean) => void;
  onDeleteGroup: (listId: string, items: ShoppingItem[]) => void;
  onDeleteItem: (listId: string, itemId: string) => void;
  onDeleteList: (id: string) => void;
}) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemStore, setItemStore] = useState("");
  const [showRecipeTags, setShowRecipeTags] = useState(false);

  const handleAddItem = (listId: string) => {
    if (!itemName.trim()) return;
    const item: Omit<NewItem, "id"> = { name: itemName, quantity: itemQuantity || null };
    if (type === "ONLINE") {
      item.url = itemUrl || null;
      item.price = itemPrice ? Number(itemPrice) : null;
      item.store = itemStore || null;
    }
    onAddItem(listId, item);
    setItemName("");
    setItemQuantity("");
    setItemUrl("");
    setItemPrice("");
    setItemStore("");
    setAddingTo(null);
  };

  if (lists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucune liste. Crée-en une !
      </p>
    );
  }

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
          <div key={list.id} className="grocery-list rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grocery-list-header">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold truncate">{list.name}</h2>
                {list.items.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="grocery-progress-bar">
                      <div
                        className="grocery-progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {checkedUniqueCount}/{uniqueCount + checkedUniqueCount}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {type === "ONLINE" && total > 0 && (
                  <span className="text-sm text-muted-foreground mr-2">
                    {total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                  </span>
                )}
                {online && type === "GROCERY" && recipes.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="grocery-icon-btn" title="Ajouter une recette">
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
                                {recipe.ingredients.length} ing.
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
                    className={`grocery-icon-btn ${showRecipeTags ? "grocery-icon-btn-active" : ""}`}
                    onClick={() => setShowRecipeTags(!showRecipeTags)}
                    title={showRecipeTags ? "Masquer les recettes" : "Voir les recettes"}
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                )}
                {online && (
                  <button
                    className="grocery-icon-btn grocery-icon-btn-danger"
                    onClick={() => onDeleteList(list.id)}
                    title="Supprimer la liste"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Items (grouped) */}
            <div className="divide-y divide-border/50">
              {grouped.map((group) => (
                <GroceryRow
                  key={group.key}
                  group={group}
                  listId={list.id}
                  type={type}
                  showRecipe={showRecipeTags}
                  onToggle={onToggleGroup}
                  onDelete={onDeleteGroup}
                />
              ))}
            </div>

            {/* Add item */}
            <div className="grocery-add-section">
              {addingTo === list.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Article"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddItem(list.id);
                      }}
                      autoFocus
                      className="text-base"
                    />
                    <Input
                      placeholder="Qté"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddItem(list.id);
                      }}
                      className="w-20"
                    />
                  </div>
                  {type === "ONLINE" && (
                    <div className="flex gap-2">
                      <Input placeholder="URL" value={itemUrl} onChange={(e) => setItemUrl(e.target.value)} />
                      <Input placeholder="Prix" type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-24" />
                      <Input placeholder="Magasin" value={itemStore} onChange={(e) => setItemStore(e.target.value)} className="w-32" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAddItem(list.id)}>Ajouter</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingTo(null)}>Annuler</Button>
                  </div>
                </div>
              ) : (
                <button
                  className="grocery-add-btn"
                  onClick={() => setAddingTo(list.id)}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un article
                </button>
              )}
            </div>

            {/* Checked items */}
            {checkedGrouped.length > 0 && (
              <CheckedSection
                groups={checkedGrouped}
                listId={list.id}
                showRecipe={showRecipeTags}
                onToggle={onToggleGroup}
                onDelete={onDeleteGroup}
              />
            )}

            {list.items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Liste vide
              </p>
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
  type,
  showRecipe,
  onToggle,
  onDelete,
}: {
  group: GroupedItem;
  listId: string;
  type: "GROCERY" | "ONLINE";
  showRecipe: boolean;
  onToggle: (listId: string, items: ShoppingItem[]) => void;
  onDelete: (listId: string, items: ShoppingItem[]) => void;
}) {
  return (
    <div className="grocery-item group">
      <button
        className="grocery-checkbox-zone"
        onClick={() => onToggle(listId, group.items)}
        aria-label={`Cocher ${group.name}`}
      >
        <div className="grocery-checkbox">
          {/* empty unchecked */}
        </div>
      </button>

      <div className="flex-1 min-w-0 py-3">
        <div className="flex items-baseline gap-2">
          <span className="grocery-item-name">{group.name}</span>
        </div>
        {showRecipe && group.recipes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {group.recipes.map((r) => (
              <span key={r.id} className="grocery-recipe-tag">
                <ChefHat className="h-3 w-3" />
                {r.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {group.totalQty && (
        <span className="grocery-qty-badge">{group.totalQty}</span>
      )}

      {group.items.some((i) => i.url) && (
        <a
          href={group.items.find((i) => i.url)!.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="grocery-icon-btn opacity-0 group-hover:opacity-100 group-active:opacity-100 touch:opacity-100 shrink-0"
          title="Ouvrir le lien"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      <button aria-label="Supprimer l'article"
        className="grocery-icon-btn opacity-0 group-hover:opacity-100 group-active:opacity-100 touch:opacity-100 shrink-0"
        onClick={() => onDelete(listId, group.items)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
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
    <div className="grocery-checked-section">
      <button
        className="grocery-checked-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <Check className="h-3.5 w-3.5" />
        <span>Fait ({groups.length})</span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 ml-auto" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="divide-y divide-border/30">
          {groups.map((group) => (
            <div key={group.key} className="grocery-checked-item group">
              <button aria-label="Décocher l'article"
                className="grocery-checkbox-zone"
                onClick={() => onToggle(listId, group.items)}
              >
                <div className="grocery-checkbox grocery-checkbox-checked grocery-checkbox-muted">
                  <Check className="h-3.5 w-3.5" />
                </div>
              </button>
              <span className="flex-1 grocery-item-name grocery-item-done">
                {group.name}
              </span>
              {group.totalQty && (
                <span className="text-xs text-muted-foreground/50">{group.totalQty}</span>
              )}
              {showRecipe && group.recipes.length > 0 && (
                <div className="flex gap-1">
                  {group.recipes.map((r) => (
                    <span key={r.id} className="grocery-recipe-tag grocery-recipe-tag-muted">
                      {r.title}
                    </span>
                  ))}
                </div>
              )}
              <button aria-label="Supprimer l'article"
                className="grocery-icon-btn opacity-0 group-hover:opacity-100 touch:opacity-100 shrink-0"
                onClick={() => onDelete(listId, group.items)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
