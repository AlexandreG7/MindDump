import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";

/**
 * Onglets segmentés v2 (Radix Tabs : flèches, rôles, focus) : le segment actif
 * est une pilule d'encre, son compteur prend l'aplat du module.
 */
export const SegmentedList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex w-full gap-1 rounded-full bg-secondary p-1.5 sm:inline-flex sm:w-auto", className)}
    {...props}
  />
));
SegmentedList.displayName = "SegmentedList";

export const SegmentedTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { count?: number; icon?: React.ReactNode; tone?: Tone }
>(({ className, children, count, icon, tone = "todo", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group/seg flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-base font-bold text-muted-foreground sm:flex-none",
      "transition-[background-color,color,transform] duration-200 outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
      "data-[state=active]:bg-ink data-[state=active]:text-ink-foreground",
      className
    )}
    {...props}
  >
    {icon}
    {children}
    {count !== undefined && (
      <span
        className={cn(
          "min-w-7 rounded-full bg-foreground/10 px-2 text-center text-sm font-extrabold leading-7 tabular-nums",
          "group-data-[state=active]/seg:text-on-tone",
          tone === "todo" && "group-data-[state=active]/seg:bg-tone-todo",
          tone === "list" && "group-data-[state=active]/seg:bg-tone-list",
          tone === "meal" && "group-data-[state=active]/seg:bg-tone-meal",
          tone === "agenda" && "group-data-[state=active]/seg:bg-tone-agenda"
        )}
      >
        {count}
      </span>
    )}
  </TabsPrimitive.Trigger>
));
SegmentedTrigger.displayName = "SegmentedTrigger";
