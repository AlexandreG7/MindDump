"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
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

/* ── List Group ───────────────────────────────────────────── */

function ListGroup({
  lists,
  type,
  recipes,
  onAddItem,
  onAddRecipeToList,
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
  const [showRecipeTags, setShowRecipeTags] = useState(false);

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

  if (lists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucune liste. Cree-en une !
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {lists.map((list) => {
        const unchecked = list.items.filter((i) => !i.checked);
        const checked = list.items.filter((i) => i.checked);
        const total = list.items.reduce((sum, i) => sum + (i.price || 0), 0);
        const progress = list.items.length > 0
          ? Math.round((checked.length / list.items.length) * 100)
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
                      {checked.length}/{list.items.length}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {type === "ONLINE" && total > 0 && (
                  <span className="text-sm text-muted-foreground mr-2">
                    {total.toFixed(2)} EUR
                  </span>
                )}
                {type === "GROCERY" && recipes.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="grocery-icon-btn" title="Ajouter une recette">
                        <CookingPot className="h-4 w-4" />
                      </button>
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
                {hasRecipeItems && (
                  <button
                    className={`grocery-icon-btn ${showRecipeTags ? "grocery-icon-btn-active" : ""}`}
                    onClick={() => setShowRecipeTags(!showRecipeTags)}
                    title={showRecipeTags ? "Masquer les recettes" : "Voir les recettes"}
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                )}
                <button
                  className="grocery-icon-btn grocery-icon-btn-danger"
                  onClick={() => onDeleteList(list.id)}
                  title="Supprimer la liste"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Items */}
            <div className="divide-y divide-border/50">
              {unchecked.map((item) => (
                <GroceryItem
                  key={item.id}
                  item={item}
                  listId={list.id}
                  type={type}
                  showRecipe={showRecipeTags}
                  onToggle={onToggleItem}
                  onDelete={onDeleteItem}
                  onUpdateQuantity={onUpdateQuantity}
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
                      placeholder="Qte"
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
            {checked.length > 0 && (
              <CheckedSection
                items={checked}
                listId={list.id}
                showRecipe={showRecipeTags}
                onToggle={onToggleItem}
                onDelete={onDeleteItem}
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

/* ── Single Grocery Item ──────────────────────────────────── */

function GroceryItem({
  item,
  listId,
  type,
  showRecipe,
  onToggle,
  onDelete,
  onUpdateQuantity,
}: {
  item: ShoppingItem;
  listId: string;
  type: "GROCERY" | "ONLINE";
  showRecipe: boolean;
  onToggle: (listId: string, itemId: string, checked: boolean) => void;
  onDelete: (listId: string, itemId: string) => void;
  onUpdateQuantity: (listId: string, itemId: string, quantity: string) => void;
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [qtyValue, setQtyValue] = useState(item.quantity || "");

  const saveQuantity = () => {
    onUpdateQuantity(listId, item.id, qtyValue);
    setEditingQty(false);
  };

  return (
    <div className="grocery-item group">
      {/* Tap zone for checkbox */}
      <button
        className="grocery-checkbox-zone"
        onClick={() => onToggle(listId, item.id, item.checked)}
        aria-label={`Cocher ${item.name}`}
      >
        <div className={`grocery-checkbox ${item.checked ? "grocery-checkbox-checked" : ""}`}>
          {item.checked && <Check className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Item content */}
      <div className="flex-1 min-w-0 py-3">
        <div className="flex items-baseline gap-2">
          <span className="grocery-item-name">{item.name}</span>
          {item.store && (
            <span className="text-xs text-muted-foreground">· {item.store}</span>
          )}
        </div>
        {showRecipe && item.recipe && (
          <span className="grocery-recipe-tag">
            <ChefHat className="h-3 w-3" />
            {item.recipe.title}
          </span>
        )}
      </div>

      {/* Quantity */}
      {editingQty ? (
        <input
          className="grocery-qty-input"
          value={qtyValue}
          onChange={(e) => setQtyValue(e.target.value)}
          onBlur={saveQuantity}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveQuantity();
            if (e.key === "Escape") setEditingQty(false);
          }}
          autoFocus
          placeholder="Qte"
        />
      ) : item.quantity ? (
        <button
          className="grocery-qty-badge"
          onClick={() => { setQtyValue(item.quantity || ""); setEditingQty(true); }}
        >
          {item.quantity}
        </button>
      ) : (
        <button
          className="grocery-qty-badge grocery-qty-badge-empty"
          onClick={() => { setQtyValue(""); setEditingQty(true); }}
        >
          +
        </button>
      )}

      {item.price != null && item.price > 0 && (
        <span className="text-xs text-muted-foreground px-1 whitespace-nowrap">
          {item.price.toFixed(2)}€
        </span>
      )}

      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="grocery-icon-btn shrink-0">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {/* Delete — visible on hover/active */}
      <button
        className="grocery-icon-btn opacity-0 group-hover:opacity-100 group-active:opacity-100 shrink-0"
        onClick={() => onDelete(listId, item.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ── Checked Items (collapsible) ──────────────────────────── */

function CheckedSection({
  items,
  listId,
  showRecipe,
  onToggle,
  onDelete,
}: {
  items: ShoppingItem[];
  listId: string;
  showRecipe: boolean;
  onToggle: (listId: string, itemId: string, checked: boolean) => void;
  onDelete: (listId: string, itemId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="grocery-checked-section">
      <button
        className="grocery-checked-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <Check className="h-3.5 w-3.5" />
        <span>Fait ({items.length})</span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 ml-auto" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="divide-y divide-border/30">
          {items.map((item) => (
            <div key={item.id} className="grocery-checked-item group">
              <button
                className="grocery-checkbox-zone"
                onClick={() => onToggle(listId, item.id, item.checked)}
              >
                <div className="grocery-checkbox grocery-checkbox-checked grocery-checkbox-muted">
                  <Check className="h-3.5 w-3.5" />
                </div>
              </button>
              <span className="flex-1 grocery-item-name grocery-item-done">
                {item.name}
              </span>
              {item.quantity && (
                <span className="text-xs text-muted-foreground/50">{item.quantity}</span>
              )}
              {showRecipe && item.recipe && (
                <span className="grocery-recipe-tag grocery-recipe-tag-muted">
                  {item.recipe.title}
                </span>
              )}
              <button
                className="grocery-icon-btn opacity-0 group-hover:opacity-100 shrink-0"
                onClick={() => onDelete(listId, item.id)}
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
