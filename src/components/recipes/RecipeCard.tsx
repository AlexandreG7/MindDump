"use client";

import { useState, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { thumbnailUrl } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BookMarked,
  CalendarCheck,
  CalendarX2,
  Camera,
  ChefHat,
  Clock,
  Download,
  Heart,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { CatalogRecipe } from "./RecipeEditor";
import { formatMinutes, parseSteps, recipeSource, SOURCE_LABELS, totalMinutes } from "./meta";

/**
 * Lien vers une fiche : un vrai <a href> (clic droit, nouvel onglet, lecteur
 * d'écran) qui navigue par le routeur de l'app. next/link pèserait ~9 kB de
 * plus sur la page pour rien : le catalogue n'a pas besoin du préchargement.
 */
function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) {
  const router = useRouter();
  const { prefetch: _prefetch, ...rest } = props as typeof props & { prefetch?: boolean };
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        router.push(href);
      }}
      {...rest}
    />
  );
}

// Modification et enrichissement servent peu : leur code ne se charge qu'au premier appui.
const RecipeEditDialog = dynamic(() => import("./RecipeEditor").then((m) => m.RecipeEditDialog), { ssr: false });
const EnrichDialog = dynamic(() => import("./RecipeEditor").then((m) => m.EnrichDialog), { ssr: false });

export type CatalogTab = "catalogue" | "prevues";

export interface ShoppingListRef {
  id: string;
  name: string;
  type?: string;
}

export interface CardHandlers {
  lists: ShoppingListRef[];
  tab: CatalogTab;
  onToggleFavorite: (e: MouseEvent, recipe: CatalogRecipe) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onAddToList: (recipeId: string, listId?: string) => void;
  onUploadImage: (recipeId: string, file: File) => void;
  onRemoveImage: (recipeId: string) => void;
  onEnriched: () => void;
  /** Ouvre le sélecteur de photo partagé de la page (hors des éléments cliquables). */
  onPickImage: (e: MouseEvent, recipeId: string) => void;
}

/** Cœur des favoris : toujours visible, cible de 44 px autour d'une pastille de 36 px. */
export function FavoriteButton({
  favorite,
  onClick,
  className,
}: {
  favorite: boolean;
  onClick: (e: MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={favorite}
      className={cn("group/fav flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card/90 shadow-surface backdrop-blur-sm transition-transform duration-150 group-active/fav:scale-90">
        <Heart className={cn("h-[1.125rem] w-[1.125rem] transition-colors", favorite ? "fill-rose-500 text-rose-500" : "text-foreground/70")} />
      </span>
    </button>
  );
}

export function RecipePhoto({
  recipe,
  width,
  className,
  iconClassName,
  priority,
}: {
  recipe: CatalogRecipe;
  width: number;
  className?: string;
  iconClassName?: string;
  priority?: boolean;
}) {
  return recipe.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbnailUrl(recipe.image, width)}
      alt=""
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-tone-meal-soft text-tone-meal-ink">
      <UtensilsCrossed className={cn("h-10 w-10 opacity-60", iconClassName)} aria-hidden />
    </span>
  );
}

function TimePill({ recipe, className }: { recipe: CatalogRecipe; className?: string }) {
  const total = totalMinutes(recipe);
  if (!total) return null;
  return (
    <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full bg-card/95 px-2.5 text-sm font-bold tabular-nums text-foreground shadow-surface", className)}>
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {formatMinutes(total)}
    </span>
  );
}

const iconBtn =
  "flex h-9 w-9 touch:h-11 touch:w-11 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Actions secondaires d'une recette (planifier, courses, modifier, enrichir,
 * supprimer, photo) en petites icônes discrètes, avec leurs fenêtres. Partagé
 * par la carte, la ligne et la tuile : aucune action ne dépend de la vue.
 * `reveal` : classe de survol du parent (`group-hover/...:opacity-100`) ;
 * toujours visibles au toucher et au focus clavier.
 */
function RecipeActions({
  recipe,
  h,
  reveal,
  className = "",
  withPhoto = false,
}: {
  recipe: CatalogRecipe;
  h: CardHandlers;
  reveal: string;
  className?: string;
  /** Ajoute « Changer la photo » (la carte l'a déjà sur sa photo). */
  withPhoto?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [enrichOpen, setEnrichOpen] = useState(false);
  // Une fois ouverts, les dialogues restent montés (animation de fermeture).
  const [editSeen, setEditSeen] = useState(false);
  const [enrichSeen, setEnrichSeen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  return (
    <>
          <div className={`flex items-center opacity-0 transition-opacity focus-within:opacity-100 touch:opacity-100 ${reveal} ${className}`}>
            {withPhoto && (
              <button type="button" onClick={(e) => h.onPickImage(e, recipe.id)} aria-label={recipe.image ? "Changer la photo" : "Ajouter une photo"} title={recipe.image ? "Changer la photo" : "Ajouter une photo"} className={iconBtn}>
                <Camera className="h-3.5 w-3.5" />
              </button>
            )}
            {h.tab === "catalogue" ? (
              <button
                type="button"
                onClick={() => h.onUpdate(recipe.id, { planned: !recipe.planned })}
                aria-pressed={recipe.planned}
                aria-label={recipe.planned ? "Retirer des recettes prévues" : "Planifier"}
                title={recipe.planned ? "Retirer des recettes prévues" : "Planifier"}
                className={cn(iconBtn, recipe.planned && "text-tone-meal-ink")}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button type="button" onClick={() => h.onDelete(recipe.id)} aria-label="Retirer des recettes prévues" title="Retirer des recettes prévues" className={cn(iconBtn, "hover:text-destructive")}>
                  <CalendarX2 className="h-3.5 w-3.5" />
                </button>
                {!recipe.inCatalog && (
                  <button type="button" onClick={() => h.onUpdate(recipe.id, { inCatalog: true })} aria-label="Garder au catalogue" title="Garder au catalogue" className={iconBtn}>
                    <BookMarked className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={() => setListOpen(true)} aria-label="Ajouter les ingrédients aux courses" title="Ajouter aux courses" className={iconBtn}>
              <ShoppingCart className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => { setEditSeen(true); setEditOpen(true); }} aria-label="Modifier la recette" title="Modifier" className={iconBtn}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => { setEnrichSeen(true); setEnrichOpen(true); }} aria-label="Enrichir depuis HelloFresh" title="Enrichir depuis HelloFresh" className={iconBtn}>
              <Download className="h-3.5 w-3.5" />
            </button>
            {h.tab === "catalogue" && (
              <button type="button" onClick={() => h.onDelete(recipe.id)} aria-label="Supprimer la recette" title="Supprimer" className={cn(iconBtn, "hover:bg-destructive/10 hover:text-destructive")}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
      {editSeen && (
        <RecipeEditDialog recipe={recipe} open={editOpen} onOpenChange={setEditOpen} onUpdate={h.onUpdate} onUploadImage={h.onUploadImage} onRemoveImage={h.onRemoveImage} />
      )}
      {enrichSeen && <EnrichDialog recipe={recipe} open={enrichOpen} onOpenChange={setEnrichOpen} onEnriched={h.onEnriched} />}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter les ingrédients aux courses</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <DialogClose asChild>
              <Button className="w-full" onClick={() => h.onAddToList(recipe.id)}>
                <Plus className="mr-2 h-4 w-4" />
                Créer une nouvelle liste
              </Button>
            </DialogClose>
            {h.lists
              .filter((l) => l.type === "GROCERY")
              .map((list) => (
                <DialogClose key={list.id} asChild>
                  <Button variant="outline" className="w-full" onClick={() => h.onAddToList(recipe.id, list.id)}>
                    Ajouter à &quot;{list.name}&quot;
                  </Button>
                </DialogClose>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Carte du catalogue : la photo d'abord, le titre, quelques repères, des actions discrètes. */
export function RecipeCard({
  recipe,
  h,
  priority,
}: {
  recipe: CatalogRecipe;
  h: CardHandlers;
  priority?: boolean;
}) {
  const source = recipeSource(recipe.image);
  const hasSteps = parseSteps(recipe.steps).length > 0;
  const href = `/recipes/${recipe.id}`;

  return (
    <article className="group/card flex min-w-0 flex-col">
      <div className="relative">
        <Link
          href={href}
          prefetch={false}
          tabIndex={-1}
          aria-hidden
          className="block aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-tone-meal-soft shadow-surface"
        >
          <RecipePhoto recipe={recipe} width={800} priority={priority} className="transition-transform duration-500 ease-out motion-safe:group-hover/card:scale-[1.03]" iconClassName="h-12 w-12" />
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {h.tab === "catalogue" && recipe.planned && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-tone-meal px-2.5 text-xs font-bold text-on-tone shadow-surface">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
              Prévue
            </span>
          )}
          {h.tab === "prevues" && recipe.inCatalog && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-card/95 px-2.5 text-xs font-bold text-foreground shadow-surface">
              <BookMarked className="h-3.5 w-3.5" aria-hidden />
              Catalogue
            </span>
          )}
        </div>

        <FavoriteButton favorite={recipe.favorite} onClick={(e) => h.onToggleFavorite(e, recipe)} className="absolute right-1.5 top-1.5" />
        <TimePill recipe={recipe} className="absolute bottom-3 left-3" />
        <button
          type="button"
          onClick={(e) => h.onPickImage(e, recipe.id)}
          aria-label={recipe.image ? "Changer la photo" : "Ajouter une photo"}
          className="absolute bottom-1.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-full text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100 touch:opacity-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <Camera className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>

      <div className="min-w-0 px-1 pt-3">
        <h2 className="font-display text-[1.5rem] leading-[1.04]">
          <Link href={href} prefetch={false} className="-my-2.5 line-clamp-2 rounded-md py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {recipe.title}
          </Link>
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {source !== "perso" && <span className="font-semibold text-foreground/80">{SOURCE_LABELS[source]} · </span>}
          {recipe.servings} pers. · {recipe.ingredients.length} ingrédient{recipe.ingredients.length > 1 ? "s" : ""}
        </p>

        <div className="-ml-2.5 mt-1 flex items-center">
          <RecipeActions recipe={recipe} h={h} reveal="group-hover/card:opacity-100" />
          {hasSteps && (
            <Link
              href={`${href}?cook=1`}
              prefetch={false}
              className="ml-auto mr-1 inline-flex h-11 items-center gap-2 rounded-full bg-tone-meal-soft px-4 text-sm font-extrabold text-tone-meal-ink transition-[filter,transform] duration-150 hover:brightness-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChefHat className="h-4 w-4" aria-hidden />
              Cuisiner
            </Link>
          )}
        </div>
      </div>

    </article>
  );
}

/** Vue liste : une ligne par recette, vignette à gauche. */
export function RecipeRow({ recipe, h }: { recipe: CatalogRecipe; h: CardHandlers }) {
  const source = recipeSource(recipe.image);
  const href = `/recipes/${recipe.id}`;
  return (
    <li className="group/row relative flex items-center gap-3 rounded-[1.25rem] bg-card p-2 pr-1 shadow-surface">
      <Link href={href} prefetch={false} aria-hidden tabIndex={-1} className="h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-2xl bg-tone-meal-soft">
        <RecipePhoto recipe={recipe} width={240} iconClassName="h-7 w-7" />
      </Link>
      <div className="min-w-0 flex-1">
        <h2 className="text-[1.0625rem] font-extrabold leading-tight tracking-tight">
          <Link href={href} prefetch={false} className="line-clamp-2 rounded-md outline-none after:absolute after:inset-0 after:rounded-[1.25rem] focus-visible:ring-2 focus-visible:ring-ring">
            {recipe.title}
          </Link>
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {totalMinutes(recipe) > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {formatMinutes(totalMinutes(recipe))}
            </span>
          )}
          {source !== "perso" && <span>{SOURCE_LABELS[source]}</span>}
          {h.tab === "catalogue" && recipe.planned && (
            <span className="inline-flex items-center gap-1 font-semibold text-tone-meal-ink">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
              Prévue
            </span>
          )}
        </p>
        <RecipeActions recipe={recipe} h={h} withPhoto reveal="group-hover/row:opacity-100" className="relative z-10 -ml-2.5 mt-0.5" />
      </div>
      <FavoriteButton favorite={recipe.favorite} onClick={(e) => h.onToggleFavorite(e, recipe)} className="relative z-10 shrink-0 [&>span]:bg-transparent [&>span]:shadow-none" />
    </li>
  );
}

/** Grille réduite : photo carrée, titre sur deux lignes. */
export function RecipeTile({ recipe, h }: { recipe: CatalogRecipe; h: CardHandlers }) {
  const href = `/recipes/${recipe.id}`;
  return (
    <li className="group/tile relative min-w-0">
      <div className="relative">
        <Link href={href} prefetch={false} aria-hidden tabIndex={-1} className="block aspect-square overflow-hidden rounded-[1.25rem] bg-tone-meal-soft shadow-surface">
          <RecipePhoto recipe={recipe} width={480} className="transition-transform duration-500 ease-out motion-safe:group-hover/tile:scale-[1.04]" iconClassName="h-9 w-9" />
        </Link>
        <FavoriteButton favorite={recipe.favorite} onClick={(e) => h.onToggleFavorite(e, recipe)} className="absolute right-0.5 top-0.5" />
        <TimePill recipe={recipe} className="absolute bottom-2 left-2 h-7 text-xs" />
      </div>
      <h2 className="mt-2 px-0.5 text-[0.9375rem] font-bold leading-snug tracking-tight">
        <Link href={href} prefetch={false} className="-my-2.5 line-clamp-2 rounded-md py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {recipe.title}
        </Link>
      </h2>
      <RecipeActions recipe={recipe} h={h} withPhoto reveal="group-hover/tile:opacity-100" className="-ml-2 flex-wrap" />
    </li>
  );
}
