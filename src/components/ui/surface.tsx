import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface de l'app : fond carte, filet + ombre douce (--shadow-surface), coins
 * 20 px. Remplace les cartes à bordure dure sur les écrans refondus.
 * `interactive` ajoute le retour au toucher (léger enfoncement).
 */
export const Surface = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
>(({ className, interactive, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[1.25rem] bg-card text-card-foreground shadow-surface",
      interactive &&
        "transition-[transform,background-color] duration-150 ease-out active:scale-[0.985] hover:bg-accent/40",
      className
    )}
    {...props}
  />
));
Surface.displayName = "Surface";
