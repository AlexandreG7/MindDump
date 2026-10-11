import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Onglets segmentés de l'app (Radix Tabs : flèches, rôles, focus). Pleine
 * largeur sur téléphone, segments de 44 px. Le compteur est un `count`
 * séparé pour rester en chiffres tabulaires.
 */
export const SegmentedList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex w-full gap-1 rounded-2xl bg-muted p-1 sm:inline-flex sm:w-auto", className)}
    {...props}
  />
));
SegmentedList.displayName = "SegmentedList";

export const SegmentedTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { count?: number; icon?: React.ReactNode }
>(({ className, children, count, icon, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[0.9375rem] font-medium text-muted-foreground sm:flex-none",
      "transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-surface",
      className
    )}
    {...props}
  >
    {icon}
    {children}
    {count !== undefined && (
      <span className="min-w-[1.5rem] rounded-full bg-foreground/[0.07] px-1.5 text-center text-xs font-semibold leading-5 tabular-nums">
        {count}
      </span>
    )}
  </TabsPrimitive.Trigger>
));
SegmentedTrigger.displayName = "SegmentedTrigger";
