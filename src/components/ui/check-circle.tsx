"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";

/**
 * Case à cocher ronde de l'app : cible tactile de 48 px, pastille de 26 px
 * dans la teinte du module, l'icône « grossit » à la coche (150 ms, neutralisé
 * par prefers-reduced-motion). Radix reste responsable de l'accessibilité
 * (role checkbox, Espace, état).
 */
export const CheckCircle = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { tone?: Tone }
>(({ className, tone = "todo", ...props }, ref) => {
  const t = TONE_CLASSES[tone];
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "group/check relative -my-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full border-2 bg-card",
          "transition-[background-color,border-color,transform] duration-150 ease-out",
          "group-active/check:scale-90 group-hover/check:bg-secondary",
          t.border,
          t.checked
        )}
      >
        <CheckboxPrimitive.Indicator forceMount>
          <Check
            className="h-4 w-4 scale-0 opacity-0 transition-[transform,opacity] duration-150 group-data-[state=checked]/check:scale-100 group-data-[state=checked]/check:opacity-100"
            strokeWidth={3}
          />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
});
CheckCircle.displayName = "CheckCircle";
