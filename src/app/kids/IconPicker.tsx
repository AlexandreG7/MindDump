"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  KID_ICON_CATEGORIES,
  KID_ICON_CATEGORY_LABELS,
  KID_ICON_IDS,
  KID_ICON_LABELS,
  KidIcon,
  type KidIconCategory,
  type KidIconId,
  isKidIconId,
} from "@/components/kids/icons";
import { cn } from "@/lib/utils";
import { KidsSheet } from "./KidsSheet";

const CATEGORIES = Object.keys(KID_ICON_CATEGORY_LABELS) as KidIconCategory[];

/**
 * Sélecteur d'image : toutes les images de la bibliothèque, rangées par catégorie.
 * Aucune image n'a de sens propre : c'est le libellé du parent qui lui en donne un.
 */
export function IconPickerSheet({
  open,
  onOpenChange,
  value,
  onPick,
  title = "Choisir une image",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onPick: (id: KidIconId) => void;
  title?: string;
}) {
  const [category, setCategory] = useState<KidIconCategory>(() =>
    isKidIconId(value) ? KID_ICON_CATEGORIES[value] : "meteo"
  );
  const ids = KID_ICON_IDS.filter((id) => KID_ICON_CATEGORIES[id] === category);
  // Onze catégories débordent en largeur : l'onglet actif reste toujours visible.
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      tabs.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [category, open]);
  return (
    <KidsSheet
      open={open}
      onOpenChange={onOpenChange}
      level={1}
      title={title}
      description="Choisis une image parmi les catégories. Elle n'a pas de sens propre : c'est ton libellé qui lui en donne un."
    >
      <div ref={tabs} role="group" aria-label="Catégories d'images" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
            className={cn(
              "h-11 shrink-0 rounded-full px-4 text-sm font-bold transition-colors",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              c === category ? "bg-ink text-ink-foreground ring-2 ring-foreground/40" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            )}
          >
            {KID_ICON_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {ids.map((id) => {
          const on = id === value;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onPick(id);
                  onOpenChange(false);
                }}
                className={cn(
                  "relative flex min-h-22 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 text-center text-xs font-bold leading-tight",
                  "transition-[transform,background-color] duration-150 active:scale-[0.96] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-tone-list-ink bg-tone-list-soft" : "border-transparent bg-secondary hover:bg-secondary/70"
                )}
              >
                <KidIcon id={id} size={44} decorative />
                <span className="text-muted-foreground">{KID_ICON_LABELS[id]}</span>
                {on && (
                  <span aria-hidden className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tone-list-ink text-card">
                    <Check className="h-3 w-3" strokeWidth={4} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </KidsSheet>
  );
}

/** Bouton qui montre l'image choisie et ouvre le sélecteur. */
export function IconPickerButton({
  value,
  onPick,
  label,
  size = 52,
  className,
}: {
  value: string;
  onPick: (id: KidIconId) => void;
  /** Nom accessible du bouton : « Image de la rubrique », « Image du choix 2 »… */
  label: string;
  size?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const known = isKidIconId(value);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label} : ${known ? KID_ICON_LABELS[value] : "aucune"}. Changer`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl bg-secondary transition-[transform,background-color] duration-150 hover:bg-secondary/70 active:scale-95",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        style={{ width: size + 8, height: size + 8 }}
      >
        {known && <KidIcon id={value} size={size - 8} decorative />}
      </button>
      {open && <IconPickerSheet open={open} onOpenChange={setOpen} value={value} onPick={onPick} title={label} />}
    </>
  );
}
