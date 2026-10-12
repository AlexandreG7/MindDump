"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "./tone";

/**
 * Même rendu que `segmented.tsx` mais sans Radix Tabs (≈ 5 kB de moins sur la
 * page) : pour les écrans où le contenu des onglets est rendu par la page
 * elle-même. Rôles tablist/tab, flèches gauche/droite, Début/Fin.
 */
export interface SegmentedNavItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export function SegmentedNav<T extends string>({
  items,
  value,
  onChange,
  tone = "todo",
  label,
  idPrefix,
  className,
  itemClassName,
}: {
  items: SegmentedNavItem<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: Tone;
  label: string;
  /** Les panneaux associés portent `id={`${idPrefix}-panel`}` et `aria-labelledby={`${idPrefix}-${valeur}`}`. */
  idPrefix: string;
  className?: string;
  /** Classes ajoutées à chaque onglet (taille, espacement). */
  itemClassName?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = items.length - 1;
    const to = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to === null) return;
    e.preventDefault();
    onChange(items[to].value);
    refs.current[to]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex w-full gap-1 rounded-full bg-secondary p-1.5 sm:inline-flex sm:w-auto", className)}>
      {items.map((it, i) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-${it.value}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "group/seg flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-base font-bold text-muted-foreground sm:flex-none",
              "outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
              on && "bg-ink text-ink-foreground",
              itemClassName
            )}
          >
            {it.icon}
            {it.label}
            {it.count !== undefined && (
              <span
                className={cn(
                  "min-w-[1.75rem] rounded-full bg-foreground/10 px-2 text-center text-sm font-extrabold leading-7 tabular-nums",
                  on && "bg-tone-meal text-on-tone",
                  on && tone === "todo" && "bg-tone-todo",
                  on && tone === "list" && "bg-tone-list",
                  on && tone === "agenda" && "bg-tone-agenda"
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
