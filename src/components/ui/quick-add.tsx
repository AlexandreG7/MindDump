"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";

/**
 * Ajout rapide : pilule d'encre de 64 px, bouton « + » à l'aplat du module
 * toujours visible (le clavier mobile n'est pas le seul moyen de valider),
 * Entrée valide aussi. Le parent garde la logique d'envoi.
 */
export function QuickAdd({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  tone = "todo",
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
  tone?: Tone;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && !disabled) onSubmit();
      }}
      className={cn(
        "flex h-16 items-center gap-2 rounded-full bg-ink pl-6 pr-2 text-ink-foreground",
        "shadow-[0_14px_30px_-16px_hsl(var(--surface-ink)/0.7)] transition-shadow focus-within:ring-[3px] focus-within:ring-ring/70",
        className
      )}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="done"
        disabled={disabled}
        className="h-full min-w-0 flex-1 bg-transparent text-[1.0625rem] font-medium text-ink-foreground outline-none placeholder:text-ink-foreground/60"
      />
      <button
        type="submit"
        aria-label="Ajouter"
        disabled={!value.trim() || disabled}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-[transform,background-color,opacity] duration-150",
          "active:scale-90 disabled:bg-ink-foreground/15 disabled:text-ink-foreground/60",
          value.trim() && !disabled && TONE_CLASSES[tone].block
        )}
      >
        <Plus className="h-6 w-6" strokeWidth={3} />
      </button>
    </form>
  );
}
