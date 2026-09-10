"use client";

import { Check, ChefHat, Clock, ShoppingCart, Users } from "lucide-react";
import { phase, useScrub } from "./motion";

const SOURCES = [
  { name: "HelloFresh", tint: "hsl(88 60% 42%)" },
  { name: "Jow", tint: "hsl(24 85% 53%)" },
  { name: "Quitoque", tint: "hsl(340 70% 52%)" },
];

const INGREDIENTS = [
  { name: "Blanc de poulet", qty: "500 g" },
  { name: "Lait de coco", qty: "400 ml" },
  { name: "Riz basmati", qty: "300 g" },
  { name: "Pâte de curry", qty: "2 c. à s." },
  { name: "Oignon", qty: "1" },
  { name: "Coriandre", qty: "1 bouquet" },
];

const STEPS = ["Repérer", "Importer", "Extraire", "Cocher"];

export function LoopSection() {
  const ref = useScrub((p, el) => {
    el.style.setProperty("--p1", phase(p, 0, 0.25).toFixed(4));
    el.style.setProperty("--p2", phase(p, 0.25, 0.5).toFixed(4));
    el.style.setProperty("--p3", phase(p, 0.5, 0.75).toFixed(4));
    el.style.setProperty("--p4", phase(p, 0.75, 1).toFixed(4));
  });

  return (
    <section ref={ref} className="relative h-[300svh] lp-alt">
      <div className="lp-stage">
        <div className="lp-shell w-full">
          <div className="text-center mb-5 md:mb-12">
            <p className="lp-eyebrow">La boucle complète</p>
            <h2 className="lp-title lp-title-compact mt-2">
              De la recette repérée
              <br className="hidden sm:block" /> au caddie rempli.
            </h2>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 max-w-md mx-auto mb-5 md:mb-10">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1">
                <div
                  className="lp-step-dot"
                  style={{ ["--fill" as string]: `var(--p${i + 1}, 0)` }}
                />
                <p className="text-[11px] text-muted-foreground mt-2 text-center">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-3 sm:gap-5 md:gap-8 items-start">
            {/* Left: sources morphing into the imported recipe */}
            <div className="relative min-h-[17rem] sm:min-h-[21rem]">
              <div className="lp-source-card absolute inset-0 space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  La recette repérée ce matin, peu importe où.
                </p>
                {SOURCES.map((source, i) => (
                  <div
                    key={source.name}
                    className="lp-card p-4 flex items-center gap-3"
                    style={{
                      opacity: `clamp(0, calc(var(--p1, 0) * 4 - ${i}), 1)`,
                      transform: `translate3d(0, calc((1 - clamp(0, calc(var(--p1, 0) * 4 - ${i}), 1)) * 16px), 0)`,
                    }}
                  >
                    <span
                      className="h-9 w-9 rounded-lg shrink-0"
                      style={{ background: source.tint }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{source.name}</p>
                      <p className="text-xs text-muted-foreground">Import en un clic</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lp-recipe-card absolute inset-0">
                <div className="lp-card overflow-hidden">
                  <div className="h-16 sm:h-28 bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                    <ChefHat className="h-9 w-9 text-white/90" />
                  </div>
                  <div className="p-3 sm:p-4">
                    <p className="font-semibold leading-tight">Curry de poulet coco</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> 35 min
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> 4 pers.
                      </span>
                    </div>

                    <ul className="mt-3 sm:mt-4 space-y-1 sm:space-y-1.5">
                      {INGREDIENTS.map((ing, i) => (
                        <li
                          key={ing.name}
                          className="lp-ing flex justify-between text-sm"
                          style={{ ["--i" as string]: i }}
                        >
                          <span>{ing.name}</span>
                          <span className="text-muted-foreground">{ing.qty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: the shopping list filling up */}
            <div className="lp-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 sm:py-3 border-b border-border bg-[hsl(220_14%_98%)]">
                <ShoppingCart className="h-4 w-4 text-primary shrink-0" />
                <p className="font-semibold text-sm flex-1">Courses de la semaine</p>
                <div className="grocery-progress-bar">
                  <div className="lp-cart-bar h-full w-full rounded-full bg-[hsl(142_60%_45%)]" />
                </div>
              </div>
              <ul className="divide-y divide-border">
                {INGREDIENTS.map((ing, i) => (
                  <li
                    key={ing.name}
                    className="lp-cart-item flex items-center gap-3 px-4 py-2 sm:py-2.5"
                    style={{ ["--i" as string]: i }}
                  >
                    <span className="h-5 w-5 rounded-md bg-[hsl(142_60%_45%)] flex items-center justify-center shrink-0">
                      <Check className="lp-cart-check h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                    <span className="text-sm flex-1">{ing.name}</span>
                    <span className="text-xs text-muted-foreground">{ing.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
