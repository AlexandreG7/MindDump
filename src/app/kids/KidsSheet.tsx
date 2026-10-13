"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Feuille du Semainier : tiroir bas sur mobile (92 % de la hauteur au plus, zone
 * sûre respectée), fenêtre centrée à partir de md. Entrée en fondu + translation
 * de 24 px sur 200 ms (réduite à rien en `prefers-reduced-motion`, voir globals.css).
 */
export function KidsSheet({
  open,
  onOpenChange,
  title,
  description,
  headerLeading,
  headerTrailing,
  footer,
  children,
  level = 0,
  className,
  hideClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Lu par les lecteurs d'écran, jamais affiché. */
  description: string;
  headerLeading?: React.ReactNode;
  headerTrailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** 0 = feuille principale, 1 = feuille ouverte par-dessus (sélecteur d'image). */
  level?: 0 | 1;
  className?: string;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn("fixed inset-0 bg-black/50 animate-[fade-in_150ms_ease-out]", level === 0 ? "z-50" : "z-[55]")}
        />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            // Le focus va au titre, pas au premier champ : pas de clavier ouvert d'office sur mobile.
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-sheet-title]")?.focus();
          }}
          className={cn(
            "fixed flex max-h-[92dvh] flex-col bg-card text-card-foreground shadow-xl outline-none",
            "inset-x-0 bottom-0 rounded-t-[1.75rem] pb-[env(safe-area-inset-bottom)]",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[85dvh] md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[1.75rem] md:pb-0",
            "animate-[sheet-in_200ms_ease-out] md:animate-[fade-in_150ms_ease-out]",
            level === 0 ? "z-50" : "z-[56]",
            className
          )}
        >
          <div className="flex shrink-0 items-center gap-1 px-3 pb-1 pt-3">
            {headerLeading}
            <DialogPrimitive.Title
              data-sheet-title
              tabIndex={-1}
              className="min-w-0 flex-1 truncate px-2 text-xl font-extrabold outline-none first-letter:uppercase"
            >
              {title}
            </DialogPrimitive.Title>
            {headerTrailing}
            {!hideClose && (
              <DialogPrimitive.Close
                aria-label="Fermer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            )}
          </div>
          <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">{children}</div>
          {footer && <div className="shrink-0 border-t border-border px-4 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
