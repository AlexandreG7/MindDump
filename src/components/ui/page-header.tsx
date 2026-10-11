import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * En-tête de page de l'app : titre, ligne de contexte (état en un coup d'œil)
 * et zone d'action à droite. Titre en `text-balance`, 28 px.
 */
export function PageHeader({
  title,
  meta,
  action,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-8 font-bold tracking-[-0.02em] text-balance">{title}</h1>
        {meta && <div className="mt-1.5 text-[0.9375rem] text-muted-foreground tabular-nums">{meta}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </header>
  );
}
