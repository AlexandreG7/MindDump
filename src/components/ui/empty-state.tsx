import * as React from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";

/** État vide : grosse pastille à l'aplat du module, une phrase en 800, une action possible. */
export function EmptyState({
  icon: Icon,
  tone = "todo",
  title,
  children,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <span className="relative mb-5 flex h-24 w-24 items-center justify-center">
        <span aria-hidden className={cn("absolute inset-0 rounded-full opacity-30", t.solid)} />
        <span aria-hidden className={cn("absolute inset-3 rounded-full", t.solid)} />
        <Icon className="relative h-9 w-9 text-on-tone" />
      </span>
      <p className="font-display text-[1.75rem] leading-[1.05] text-balance">{title}</p>
      {children && <p className="mt-2 max-w-xs text-base text-muted-foreground text-pretty">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
