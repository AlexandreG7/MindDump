import * as React from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";

/** État vide : pastille de la teinte du module, une phrase, une action possible. */
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
      <span className={cn("mb-4 flex h-14 w-14 items-center justify-center rounded-2xl", t.soft, t.ink)}>
        <Icon className="h-7 w-7" />
      </span>
      <p className="text-lg font-semibold text-balance">{title}</p>
      {children && <p className="mt-1 max-w-xs text-[0.9375rem] text-muted-foreground text-pretty">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
