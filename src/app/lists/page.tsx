"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  ShoppingCart,
  Globe,
  ExternalLink,
  ChefHat,
  CookingPot,
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

export default function ListsPage() {
  const { isReady } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newList, setNewList] = useState({ name: "", type: "GROCERY" as "GROCERY" | "ONLINE" });

  const fetchLists = useCallback(() => {
    fetch("/api/lists").then((r) => r.json()).then(setLists);
  }, []);

  const fetchRecipes = useCallback(() => {
    fetch("/api/recipes").then((r) => r.json()).then(setRecipes);
  }, []);

  useEffect(() => {
    if (isReady) {
      fetchLists();
      fetchRecipes();
    }
  }, [isReady, fetchLists, fetchRecipes]);

  const createList = async () => {
    if (!newList.name.trim()) return;
    await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newList),
    });
    setNewList({ name: "", type: "GROCERY" });
    setDialogOpen(false);
    fetchLists();
  };

  const deleteList = async (id: string) => {
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    fetchLists();
  };

  const addItem = async (listId: string, item: Partial<ShoppingItem>) => {
    await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    fetchLists();
  };

  const addRecipeToList = async (listId: string, recipeId: string) => {
    await fetch(`/api/recipes/${recipeId}/to-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId }),
    });
    fetchLists();
  };

  const addItemToRecipe = async (
    listId: string,
    itemIds: string[],
    recipeId: string | null,
    newRecipeTitle: string | null
  ) => {
    if (recipeId) {
      // Add items as ingredients to existing recipe
      const items = lists
        .find((l) => l.id === listId)
        ?.items.filter((i) => itemIds.includes(i.id));
      if (!items) return;
      await fetch(`/api/recipes/${recipeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addIngredients: items.map((i) => ({
            name: i.name,
            quantity: i.quantity || "1",
          })),
        }),
      });
      // Link shopping items to recipe
      for (const itemId of itemIds) {
        await fetch(`/api/lists/${listId}/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId }),
        });
      }
    } else if (newRecipeTitle) {
      // Create new recipe from items
      await fetch(`/api/lists/${listId}/to-recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, title: newRecipeTitle }),
      });
    }
    fetchLists();
    fetchRecipes();
  };

  const toggleItem = async (listId: string, itemId: string, checked: boolean) => {
    await fetch(`/api/lists/${listId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !checked }),
    });
    fetchLists();
  };

  const updateItemQuantity = async (listId: string, itemId: string, quantity: string) => {
    await fetch(`/api/lists/${listId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: quantity || null }),
    });
    fetchLists();
  };

  const deleteItem = async (listId: string, itemId: string) => {
    await fetch(`/api/lists/${listId}/items/${itemId}`, { method: "DELETE" });
    fetchLists();
  };

  if (!isReady) return null;

  const groceryLists = lists.filter((l) => l.type === "GROCERY");
  const onlineLists = lists.filter((l) => l.type === "ONLINE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes listes</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle liste
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Creer une liste</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input
                  value={newList.name}
                  onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                  placeholder="Ex: Courses semaine, Wishlist Amazon..."
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
                Creer
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
            onAddItem={addItem}
            onAddRecipeToList={addRecipeToList}
            onAddItemToRecipe={addItemToRecipe}
            onToggleItem={toggleItem}
            onDeleteItem={deleteItem}
            onUpdateQuantity={updateItemQuantity}
            onDeleteList={deleteList}
          />
        </TabsContent>

        <TabsContent value="online">
          <ListGroup
            lists={onlineLists}
            type="ONLINE"
            recipes={recipes}
            onAddItem={addItem}
            onAddRecipeToList={addRecipeToList}
            onAddItemToRecipe={addItemToRecipe}
            onToggleItem={toggleItem}
            onDeleteItem={deleteItem}
            onUpdateQuantity={updateItemQuantity}
            onDeleteList={deleteList}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Add to Recipe Dialog ─────────────────────────────────── */

function AddToRecipeDialog({
  itemIds,
  listId,
  recipes,
  onAddItemToRecipe,
  onDone,
  trigger,
}: {
  itemIds: string[];
  listId: string;
  recipes: Recipe[];
  onAddItemToRecipe: (
    listId: string,
    itemIds: string[],
    recipeId: string | null,
    newTitle: string | null
  ) => void;
  onDone: () => void;
  trigger: React.ReactNode;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [mode, setMode] = useState<"pick" | "create">("pick");

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter a une recette</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {mode === "pick" ? (
            <>
              {recipes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recettes existantes</p>
                  {recipes.map((recipe) => (
                    <DialogClose key={recipe.id} asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          onAddItemToRecipe(listId, itemIds, recipe.id, null);
                          onDone();
                        }}
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
              )}
              <div className="border-t pt-3">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setMode("create")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Creer une nouvelle recette
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Nom de la recette</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Poulet aux legumes..."
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      onAddItemToRecipe(
                        listId,
                        itemIds,
                        null,
                        newTitle || "Nouvelle recette"
                      );
                      setNewTitle("");
                      setMode("pick");
                      onDone();
                    }}
                  >
                    Creer
                  </Button>
                </DialogClose>
                <Button variant="ghost" onClick={() => setMode("pick")}>
                  Retour
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── List Group ───────────────────────────────────────────── */

function ListGroup({
  lists,
  type,
  recipes,
  onAddItem,
  onAddRecipeToList,
  onAddItemToRecipe,
  onToggleItem,
  onDeleteItem,
  onUpdateQuantity,
  onDeleteList,
}: {
  lists: ShoppingList[];
  type: "GROCERY" | "ONLINE";
  recipes: Recipe[];
  onAddItem: (listId: string, item: Partial<ShoppingItem>) => void;
  onAddRecipeToList: (listId: string, recipeId: string) => void;
  onAddItemToRecipe: (
    listId: string,
    itemIds: string[],
    recipeId: string | null,
    newTitle: string | null
  ) => void;
  onToggleItem: (listId: string, itemId: string, checked: boolean) => void;
  onDeleteItem: (listId: string, itemId: string) => void;
  onUpdateQuantity: (listId: string, itemId: string, quantity: string) => void;
  onDeleteList: (id: string) => void;
}) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemStore, setItemStore] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, Set<string>>>({});

  const handleAddItem = (listId: string) => {
    if (!itemName.trim()) return;
    const item: Partial<ShoppingItem> = { name: itemName, quantity: itemQuantity || null };
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

  const toggleSelectItem = (listId: string, itemId: string) => {
    setSelectedItems((prev) => {
      const current = new Set(prev[listId] || []);
      if (current.has(itemId)) current.delete(itemId);
      else current.add(itemId);
      return { ...prev, [listId]: current };
    });
  };

  const getSelected = (listId: string) => selectedItems[listId] || new Set<string>();

  if (lists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucune liste. Cree-en une !
      </p>
    );
  }

  return (
    <div className="masonry-grid">
      {lists.map((list) => {
        const unchecked = list.items.filter((i) => !i.checked);
        const checked = list.items.filter((i) => i.checked);
        const total = list.items.reduce((sum, i) => sum + (i.price || 0), 0);
        const selected = getSelected(list.id);

        // Group by recipe
        const noRecipeItems = unchecked.filter((i) => !i.recipeId);
        const recipeGroups = new Map<string, { title: string; items: ShoppingItem[] }>();
        for (const item of unchecked) {
          if (item.recipeId && item.recipe) {
            if (!recipeGroups.has(item.recipeId)) {
              recipeGroups.set(item.recipeId, { title: item.recipe.title, items: [] });
            }
            recipeGroups.get(item.recipeId)!.items.push(item);
          }
        }

        return (
          <div key={list.id} className="paper-list rounded-xl pt-8 pb-8 px-2 sm:px-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pl-12 pr-2">
              <h2 className="handwritten text-2xl font-semibold">{list.name}</h2>
              <div className="flex items-center gap-1">
                {type === "ONLINE" && total > 0 && (
                  <span className="text-sm text-muted-foreground mr-2">
                    {total.toFixed(2)} EUR
                  </span>
                )}

                {/* Add from recipe button */}
                {type === "GROCERY" && recipes.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <CookingPot className="h-4 w-4 mr-1" />
                        Recette
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ajouter les ingredients d&apos;une recette</DialogTitle>
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

                <Button variant="ghost" size="icon" onClick={() => onDeleteList(list.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Checkerboard grid of items */}
            {unchecked.length > 0 && (
              <div className="ml-12 mr-2">
                {/* Ungrouped items in damier */}
                {noRecipeItems.length > 0 && (
                  <div className="checkerboard-grid rounded-lg overflow-hidden mb-3">
                    {noRecipeItems.map((item) => (
                      <ItemCell
                        key={item.id}
                        item={item}
                        listId={list.id}
                        type={type}
                        isSelected={selected.has(item.id)}
                        recipes={recipes}
                        onToggle={onToggleItem}
                        onDelete={onDeleteItem}
                        onSelect={toggleSelectItem}
                        onAddItemToRecipe={onAddItemToRecipe}
                        onUpdateQuantity={onUpdateQuantity}
                      />
                    ))}
                  </div>
                )}

                {/* Recipe-grouped items */}
                {Array.from(recipeGroups.entries()).map(([recipeId, group]) => (
                  <div key={recipeId} className="mb-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ChefHat className="h-3.5 w-3.5 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
                        {group.title}
                      </span>
                    </div>
                    <div className="checkerboard-grid rounded-lg overflow-hidden border-l-2 border-orange-300">
                      {group.items.map((item) => (
                        <ItemCell
                          key={item.id}
                          item={item}
                          listId={list.id}
                          type={type}
                          isSelected={selected.has(item.id)}
                          recipes={recipes}
                          onToggle={onToggleItem}
                          onDelete={onDeleteItem}
                          onSelect={toggleSelectItem}
                          onAddItemToRecipe={onAddItemToRecipe}
                          onUpdateQuantity={onUpdateQuantity}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selection bar */}
            {selected.size > 0 && (
              <div className="ml-12 mr-2 mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {selected.size} selectionne(s)
                </span>
                <AddToRecipeDialog
                  itemIds={Array.from(selected)}
                  listId={list.id}
                  recipes={recipes}
                  onAddItemToRecipe={onAddItemToRecipe}
                  onDone={() =>
                    setSelectedItems((prev) => ({ ...prev, [list.id]: new Set() }))
                  }
                  trigger={
                    <Button size="sm" variant="secondary" className="text-xs">
                      <ChefHat className="h-3.5 w-3.5 mr-1" />
                      Ajouter a une recette
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() =>
                    setSelectedItems((prev) => ({ ...prev, [list.id]: new Set() }))
                  }
                >
                  Annuler
                </Button>
              </div>
            )}

            {/* Checked items */}
            {checked.length > 0 && (
              <div className="ml-12 mr-2 mt-4 pt-3 border-t border-dashed border-muted-foreground/20">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Fait ({checked.length})
                </p>
                <div className="space-y-1">
                  {checked.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <Checkbox
                        checked
                        onCheckedChange={() => onToggleItem(list.id, item.id, item.checked)}
                      />
                      <span className="handwritten checked-item flex-1">{item.name}</span>
                      {item.recipe && <span className="tag-recipe">{item.recipe.title}</span>}
                      <Button variant="ghost" size="icon" onClick={() => onDeleteItem(list.id, item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add item */}
            <div className="ml-12 mr-2 mt-3">
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
                      className="handwritten"
                    />
                    <Input
                      placeholder="Qte"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setAddingTo(list.id)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un article
                </Button>
              )}
            </div>

            {list.items.length === 0 && (
              <p className="handwritten text-muted-foreground text-center py-4 pl-12">
                Liste vide...
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Single Item Cell (checkerboard) ──────────────────────── */

function ItemCell({
  item,
  listId,
  type,
  isSelected,
  recipes,
  onToggle,
  onDelete,
  onSelect,
  onAddItemToRecipe,
  onUpdateQuantity,
}: {
  item: ShoppingItem;
  listId: string;
  type: "GROCERY" | "ONLINE";
  isSelected: boolean;
  recipes: Recipe[];
  onToggle: (listId: string, itemId: string, checked: boolean) => void;
  onDelete: (listId: string, itemId: string) => void;
  onSelect: (listId: string, itemId: string) => void;
  onAddItemToRecipe: (
    listId: string,
    itemIds: string[],
    recipeId: string | null,
    newTitle: string | null
  ) => void;
  onUpdateQuantity: (listId: string, itemId: string, quantity: string) => void;
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [qtyValue, setQtyValue] = useState(item.quantity || "");

  const saveQuantity = () => {
    onUpdateQuantity(listId, item.id, qtyValue);
    setEditingQty(false);
  };

  return (
    <div
      className={`flex items-center gap-2 transition-colors group ${
        isSelected ? "!bg-orange-50 ring-1 ring-orange-200 ring-inset" : ""
      }`}
    >
      <Checkbox
        checked={item.checked}
        onCheckedChange={() => onToggle(listId, item.id, item.checked)}
      />
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onSelect(listId, item.id)}
      >
        <span className="handwritten">{item.name}</span>
        {item.store && (
          <span className="text-xs text-muted-foreground ml-1">- {item.store}</span>
        )}
        {item.price != null && item.price > 0 && (
          <span className="text-xs text-muted-foreground ml-1">
            {item.price.toFixed(2)} EUR
          </span>
        )}
      </div>

      {/* Inline quantity editing */}
      {editingQty ? (
        <input
          className="w-16 text-xs border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={qtyValue}
          onChange={(e) => setQtyValue(e.target.value)}
          onBlur={saveQuantity}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveQuantity();
            if (e.key === "Escape") setEditingQty(false);
          }}
          autoFocus
          placeholder="Qte"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
            item.quantity
              ? "text-muted-foreground hover:bg-muted"
              : "opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:bg-muted"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setQtyValue(item.quantity || "");
            setEditingQty(true);
          }}
          title="Modifier la quantite"
        >
          {item.quantity || "qte"}
        </button>
      )}

      {/* Add to recipe button (visible on hover or when no recipe linked) */}
      {!item.recipeId && (
        <AddToRecipeDialog
          itemIds={[item.id]}
          listId={listId}
          recipes={recipes}
          onAddItemToRecipe={onAddItemToRecipe}
          onDone={() => {}}
          trigger={
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-orange-100"
              title="Ajouter a une recette"
            >
              <ChefHat className="h-3.5 w-3.5 text-orange-500" />
            </button>
          }
        />
      )}

      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
        onClick={() => onDelete(listId, item.id)}
      >
        <Trash2 className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}
