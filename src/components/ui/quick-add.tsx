"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Champ d'ajout rapide : 52 px, bouton « + » toujours visible (le clavier
 * mobile n'est pas le seul moyen de valider), validation par Entrée aussi.
 * Le parent garde la logique d'envoi ; ce composant ne fait que collecter le
 * texte et appeler `onSubmit`.
 */
export function QuickAdd({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
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
        "flex h-[3.25rem] items-center gap-1 rounded-2xl bg-card pl-4 pr-1 shadow-surface",
        "transition-shadow focus-within:ring-2 focus-within:ring-ring/70",
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
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label="Ajouter"
        disabled={!value.trim() || disabled}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-[transform,background-color,opacity] duration-150",
          "bg-primary text-primary-foreground active:scale-90 disabled:bg-secondary disabled:text-muted-foreground"
        )}
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </form>
  );
}
