"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { burst } from "@/lib/motionUi";
import { TONE_CLASSES, type Tone } from "./tone";

/**
 * Case ronde de l'app v2 : cible tactile de 48 px, pastille de 32 px. À la
 * coche, l'aplat de la teinte du module se remplit avec un ressort et une
 * gerbe d'étincelles part de la case (neutralisé en mouvement réduit).
 * Radix reste responsable de l'accessibilité (role checkbox, Espace, état).
 */
export const CheckCircle = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { tone?: Tone }
>(({ className, tone = "todo", onCheckedChange, ...props }, ref) => {
  const t = TONE_CLASSES[tone];
  const dot = React.useRef<HTMLSpanElement>(null);
  // Le ressort ne joue qu'à la coche, pas au chargement d'une ligne déjà cochée.
  const [pop, setPop] = React.useState(false);
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      onCheckedChange={(value) => {
        if (value === true) {
          setPop(true);
          window.setTimeout(() => setPop(false), 700);
        }
        if (value === true) burst(dot.current, { colors: [`hsl(var(--tone-${tone}))`, "hsl(var(--foreground))"], radius: 30 });
        onCheckedChange?.(value);
      }}
      className={cn(
        "group/check relative -my-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        ref={dot}
        data-pop={pop || undefined}
        aria-hidden
        className={cn(
          "check-dot flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-foreground/55 bg-card text-on-tone",
          "transition-[background-color,border-color,transform] duration-150 ease-out",
          "group-active/check:scale-90 group-hover/check:border-foreground",
          "group-data-[state=checked]/check:border-transparent",
          t.solidChecked
        )}
      >
        <CheckboxPrimitive.Indicator forceMount>
          <Check
            className="h-[1.125rem] w-[1.125rem] scale-0 opacity-0 transition-[transform,opacity] duration-200 group-data-[state=checked]/check:scale-100 group-data-[state=checked]/check:opacity-100"
            strokeWidth={3.5}
          />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
});
CheckCircle.displayName = "CheckCircle";
