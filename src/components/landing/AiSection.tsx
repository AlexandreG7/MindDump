"use client";

import { Camera, Check, ChefHat, Sparkles } from "lucide-react";
import { Reveal, useReveal, useTypewriter } from "./motion";

/* Two stylised camera shots. Both are CSS illustrations, never mock photos. */

/* Items are anchored by their bottom edge so they rest on a shelf whatever
   their height, at any frame size. */
const SHELVES = ["69.5%", "38.5%", "5%"];

const FRIDGE_ITEMS: {
  shelf: number;
  left: string;
  w: number;
  h: number;
  radius: string;
  tint: string;
}[] = [
  { shelf: 0, left: "9%", w: 30, h: 30, radius: "50%", tint: "hsl(4 72% 57%)" },
  { shelf: 0, left: "25%", w: 25, h: 25, radius: "50%", tint: "hsl(4 72% 63%)" },
  { shelf: 0, left: "43%", w: 34, h: 38, radius: "0.35rem", tint: "hsl(48 85% 60%)" },
  { shelf: 0, left: "64%", w: 27, h: 31, radius: "50% 50% 42% 42%", tint: "hsl(28 80% 58%)" },
  { shelf: 0, left: "81%", w: 22, h: 26, radius: "0.3rem", tint: "hsl(340 45% 68%)" },
  { shelf: 1, left: "8%", w: 66, h: 18, radius: "999px", tint: "hsl(96 45% 43%)" },
  { shelf: 1, left: "42%", w: 21, h: 21, radius: "50%", tint: "hsl(52 70% 90%)" },
  { shelf: 1, left: "56%", w: 21, h: 21, radius: "50%", tint: "hsl(52 70% 90%)" },
  { shelf: 1, left: "70%", w: 21, h: 21, radius: "50%", tint: "hsl(52 70% 90%)" },
  { shelf: 1, left: "84%", w: 21, h: 21, radius: "50%", tint: "hsl(52 70% 90%)" },
  { shelf: 2, left: "10%", w: 36, h: 46, radius: "0.3rem 0.3rem 0.5rem 0.5rem", tint: "hsl(200 45% 68%)" },
  { shelf: 2, left: "34%", w: 50, h: 34, radius: "0.4rem", tint: "hsl(150 35% 60%)" },
  { shelf: 2, left: "62%", w: 26, h: 40, radius: "0.3rem", tint: "hsl(24 55% 62%)" },
  { shelf: 2, left: "79%", w: 30, h: 28, radius: "0.35rem", tint: "hsl(280 30% 70%)" },
];

function FridgeShot() {
  return (
    <div className="lp-fridge">
      <span className="lp-shelf" style={{ top: "31%" }} />
      <span className="lp-shelf" style={{ top: "62%" }} />
      {FRIDGE_ITEMS.map((item, i) => (
        <i
          key={i}
          className="lp-food"
          style={{
            left: item.left,
            bottom: SHELVES[item.shelf],
            width: item.w,
            height: item.h,
            borderRadius: item.radius,
            background: item.tint,
          }}
        />
      ))}
    </div>
  );
}

function RecipePageShot() {
  return (
    <div className="lp-page">
      <span className="lp-page-photo" />
      <span className="lp-line" style={{ width: "62%", height: 9 }} />
      <span className="lp-line" style={{ width: "38%", height: 6, opacity: 0.55 }} />
      <span className="lp-line lp-line-gap" style={{ width: "88%" }} />
      <span className="lp-line" style={{ width: "80%" }} />
      <span className="lp-line" style={{ width: "84%" }} />
      <span className="lp-line" style={{ width: "54%" }} />
    </div>
  );
}

function Shot({
  children,
  caption,
  revealed,
}: {
  children: React.ReactNode;
  caption: string;
  revealed: boolean;
}) {
  return (
    <div>
      <div className="lp-frame" data-revealed={revealed}>
        {children}
        <span className="lp-scan" />
        <span className="lp-corner lp-corner-tl" />
        <span className="lp-corner lp-corner-tr" />
        <span className="lp-corner lp-corner-bl" />
        <span className="lp-corner lp-corner-br" />
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-3">
        <Camera className="h-3.5 w-3.5" />
        {caption}
      </p>
    </div>
  );
}

function Chips({ items, revealed }: { items: string[]; revealed: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={item}
          className="lp-chip"
          data-revealed={revealed}
          style={{ ["--delay" as string]: `${500 + i * 110}ms` }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Outcome({
  revealed,
  delay,
  title,
  meta,
  note,
}: {
  revealed: boolean;
  delay: number;
  title: string;
  meta: string;
  note: string;
}) {
  return (
    <div className="lp-outcome" data-revealed={revealed} style={{ ["--delay" as string]: `${delay}ms` }}>
      <div className="lp-card p-4 flex items-start gap-3">
        <span className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shrink-0">
          <ChefHat className="h-5 w-5 text-white" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-[hsl(142_60%_38%)] mt-2">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
            {note}
          </p>
        </div>
      </div>
    </div>
  );
}

function Scenario({
  eyebrow,
  title,
  body,
  shot,
  caption,
  chips,
  outcome,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  shot: React.ReactNode;
  caption: string;
  chips: string[];
  outcome: { title: string; meta: string; note: string };
  flip?: boolean;
}) {
  const { ref, revealed } = useReveal(0.25);

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
      <div className={flip ? "md:order-2" : undefined}>
        <Shot caption={caption} revealed={revealed}>
          {shot}
        </Shot>
      </div>

      <div className={flip ? "md:order-1" : undefined}>
        <p className="lp-eyebrow">{eyebrow}</p>
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 leading-tight">{title}</h3>
        <p className="text-muted-foreground mt-3 leading-relaxed">{body}</p>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Ce que l&apos;assistant reconnaît
            </p>
            <Chips items={chips} revealed={revealed} />
          </div>
          <Outcome revealed={revealed} delay={500 + chips.length * 110 + 250} {...outcome} />
        </div>
      </div>
    </div>
  );
}

export function AiSection() {
  const { ref, revealed } = useReveal(0.4);
  const typed = useTypewriter("Ajoute la blanquette de jeudi à la liste de courses", revealed);
  const done = typed.length > 46;

  return (
    <section className="py-24 md:py-32 lp-alt">
      <div className="lp-shell">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="lp-eyebrow">Assistant IA</p>
          <h2 className="lp-title mt-2">Prends une photo. C&apos;est déjà dans l&apos;app.</h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            MindDump se connecte à ton assistant IA. Il voit ce que tu photographies, comprend ce
            qu&apos;il y a dedans, et écrit directement dans l&apos;application — sans que tu
            saisisses une ligne.
          </p>
        </Reveal>

        <div className="mt-16 md:mt-20 space-y-20 md:space-y-28">
          <Scenario
            eyebrow="Une recette repérée"
            title="Un livre, un magazine, l'ardoise d'un resto."
            body="Photographie la page. L'assistant lit le titre, les ingrédients et les étapes, puis crée la fiche complète dans ton catalogue — prête à passer en liste de courses."
            caption="Photo d'une page de recette"
            shot={<RecipePageShot />}
            chips={["Poireaux", "Crème", "Pâte brisée", "Œufs", "Muscade", "45 min"]}
            outcome={{
              title: "Tarte aux poireaux",
              meta: "6 ingrédients · 45 min · 4 personnes",
              note: "Ajoutée à ton catalogue",
            }}
          />

          <Scenario
            flip
            eyebrow="Ton frigo"
            title="« Qu'est-ce que je fais avec ça ? »"
            body="Ouvre le frigo, prends une photo. L'assistant identifie ce qu'il reste, invente une recette avec, et l'ajoute à tes repas planifiés. Zéro course en plus, zéro gâchis."
            caption="Photo de l'intérieur du frigo"
            shot={<FridgeShot />}
            chips={["Courgette", "Œufs", "Feta", "Tomates", "Crème", "Citron"]}
            outcome={{
              title: "Omelette courgette-feta",
              meta: "Rien à acheter · 20 min",
              note: "Ajoutée à tes repas planifiés",
            }}
          />
        </div>

        {/* Third proof: plain language, no photo */}
        <Reveal className="mt-20 md:mt-28 max-w-3xl mx-auto">
          <p className="text-center text-muted-foreground mb-6">
            Ou demande-le simplement, en une phrase.
          </p>

          <div ref={ref} className="lp-card overflow-hidden font-mono text-sm">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-[hsl(220_14%_98%)]">
              {["hsl(0 72% 62%)", "hsl(40 90% 58%)", "hsl(142 50% 50%)"].map((tint) => (
                <span key={tint} className="h-2.5 w-2.5 rounded-full" style={{ background: tint }} />
              ))}
              <span className="text-xs text-muted-foreground ml-2 font-sans">minddump-mcp</span>
            </div>

            <div className="p-4 sm:p-5 space-y-3 min-h-[8.5rem]">
              <p className="break-words">
                <span className="text-primary select-none">&gt;&nbsp;</span>
                {typed}
                {!done && <span className="lp-caret ml-0.5" />}
              </p>

              {done && (
                <div className="lp-reveal" data-revealed="true">
                  <p className="text-muted-foreground flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>
                      6 ingrédients ajoutés à <strong>Courses de la semaine</strong>.
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-5">
            Fonctionne avec tout assistant compatible MCP. Recettes, courses, tâches et calendrier.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
