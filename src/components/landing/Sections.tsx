"use client";

import Link from "next/link";
import {
  Baby,
  Calendar,
  CheckSquare,
  ChefHat,
  Link2,
  ShoppingCart,
  Sparkles,
  ToggleLeft,
} from "lucide-react";
import { Reveal, useReveal, useScrub, useTypewriter } from "./motion";

/* ── 2. The chaos: scattered notes converging into a tidy stack ── */

const CHAOS_NOTES = [
  { text: "rdv pédiatre jeudi", x0: -270, y0: -104, r0: -11 },
  { text: "acheter du pain", x0: 250, y0: -118, r0: 9 },
  { text: "relancer le plombier", x0: -300, y0: 34, r0: 6 },
  { text: "cadeau anniv Léo", x0: 288, y0: 18, r0: -8 },
  { text: "on mange quoi jeudi ?", x0: -170, y0: 122, r0: 12 },
  { text: "vaccin du chat", x0: 186, y0: 134, r0: -6 },
  { text: "réunion parents 18h", x0: -66, y0: -136, r0: 4 },
  { text: "lessive + pharmacie", x0: 74, y0: 106, r0: -13 },
  { text: "renouveler le passeport", x0: 8, y0: -22, r0: 7 },
];

export function ChaosSection() {
  const ref = useScrub((p, el) => {
    // Ease the convergence so the notes settle rather than snap.
    const raw = Math.min(1, Math.max(0, (p - 0.12) / 0.58));
    const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
    el.style.setProperty("--cp", eased.toFixed(4));
    el.style.setProperty("--before", (1 - Math.min(1, raw * 1.9)).toFixed(4));
    el.style.setProperty("--after", Math.max(0, (raw - 0.55) / 0.45).toFixed(4));
  });

  return (
    <section ref={ref} className="relative h-[220svh]">
      <div className="lp-stage">
        <div className="lp-shell w-full">
          <div className="relative text-center h-24 sm:h-28 mb-2">
            <div style={{ opacity: "var(--before, 1)" }} className="absolute inset-0">
              <p className="lp-eyebrow">La charge mentale</p>
              <h2 className="lp-title mt-2">Ça, c&apos;est une semaine dans ta tête.</h2>
            </div>
            <div style={{ opacity: "var(--after, 0)" }} className="absolute inset-0">
              <p className="lp-eyebrow">Le soulagement</p>
              <h2 className="lp-title mt-2">MindDump la range.</h2>
            </div>
          </div>

          <div className="lp-chaos-stage" aria-hidden="true">
            {CHAOS_NOTES.map((note, i) => (
              <div
                key={note.text}
                className="lp-note lp-chaos-note"
                style={
                  {
                    "--x0": note.x0,
                    "--dx": -note.x0,
                    "--y0": note.y0,
                    "--dy": (i - 4) * 34 - note.y0,
                    "--r0": note.r0,
                    "--dr": -note.r0,
                    zIndex: i,
                  } as React.CSSProperties
                }
              >
                {note.text}
              </div>
            ))}
          </div>

          <p className="text-center text-muted-foreground mt-6 max-w-lg mx-auto text-sm sm:text-base">
            Tout est là, éparpillé entre quatre applications et ta mémoire. Un seul endroit
            suffit.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── 4. The modules ── */

const MODULES = [
  {
    icon: ChefHat,
    title: "Recettes",
    body: "La recette repérée ce matin sur HelloFresh, Jow ou Quitoque arrive entière : ingrédients, temps, portions. Mode cuisine plein écran, l'écran reste allumé.",
  },
  {
    icon: ShoppingCart,
    title: "Courses",
    body: "Générées depuis tes recettes, en un geste. Cochées à deux, en temps réel, chacun dans son rayon.",
  },
  {
    icon: CheckSquare,
    title: "Tâches",
    body: "Priorités, échéances, rappels par mail. Ce qui est urgent remonte tout seul, le reste attend.",
  },
  {
    icon: Calendar,
    title: "Calendrier",
    body: "Abonne-toi aux agendas que tu as déjà, exporte le tien en .ics. Les repas planifiés s'y affichent.",
  },
  {
    icon: Baby,
    title: "Semainier",
    body: "La journée de ton enfant en un coup d'œil : humeur, sieste, activités, météo. Et les tendances sur le mois.",
  },
];

export function ModulesSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="lp-shell">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="lp-eyebrow">Tout le foyer</p>
          <h2 className="lp-title mt-2">Cinq domaines, une seule app.</h2>
          <p className="text-muted-foreground mt-4">
            Chaque module s&apos;active ou se désactive. Tu ne gardes que ce que tu utilises
            vraiment.
          </p>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {MODULES.map((module, i) => (
            <Reveal key={module.title} delay={i * 80} className="lp-reveal-scale">
              <article className="lp-card p-6 h-full">
                <span className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center">
                  <module.icon className="h-5 w-5 text-accent-foreground" />
                </span>
                <h3 className="font-semibold text-lg mt-4">{module.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {module.body}
                </p>
              </article>
            </Reveal>
          ))}

          <Reveal delay={MODULES.length * 80} className="lp-reveal-scale">
            <article className="h-full rounded-xl border border-dashed border-border p-6 flex flex-col justify-center">
              <ToggleLeft className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                Pas besoin de tout. Active les modules un par un depuis ton profil — l&apos;app
                se réduit à ce dont tu as besoin.
              </p>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── 5. The household ── */

export function HouseholdSection() {
  return (
    <section className="py-24 md:py-32 lp-alt">
      <div className="lp-shell grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <Reveal className="lp-reveal-left">
          <p className="lp-eyebrow">Partagé</p>
          <h2 className="lp-title mt-2">Une liste partagée vaut mieux que dix rappels.</h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Invite ton foyer avec un lien. Pas de compte à configurer, pas de réglages. Les
            recettes, les courses et le calendrier deviennent communs — et la charge cesse de
            reposer sur une seule personne.
          </p>
          <div className="flex items-center gap-2 mt-6 text-sm font-medium text-primary">
            <Link2 className="h-4 w-4" />
            Un lien suffit
          </div>
        </Reveal>

        <Reveal delay={120} className="lp-reveal-right">
          <div className="lp-card p-6">
            <p className="text-sm font-semibold">Notre foyer</p>
            <p className="text-xs text-muted-foreground mt-0.5">4 membres</p>

            <div className="flex -space-x-2 mt-5">
              {["A", "M", "L", "T"].map((initial, i) => (
                <span
                  key={initial}
                  className="h-10 w-10 rounded-full border-2 border-white flex items-center justify-center text-sm font-semibold text-white"
                  style={{ background: `hsl(${24 + i * 44} 70% 55%)` }}
                >
                  {initial}
                </span>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-[hsl(220_14%_98%)] px-3 py-2.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <code className="text-xs text-muted-foreground truncate">
                minddump.app/groups/join/…
              </code>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 6. The week strip ── */

const WEEK = [
  { day: "Lun", mood: "🙂", weather: "☀️" },
  { day: "Mar", mood: "😄", weather: "⛅" },
  { day: "Mer", mood: "😴", weather: "🌧️" },
  { day: "Jeu", mood: "🙂", weather: "☀️" },
  { day: "Ven", mood: "😄", weather: "☀️" },
  { day: "Sam", mood: "🤩", weather: "⛅" },
  { day: "Dim", mood: "🙂", weather: "🌧️" },
];

export function WeekSection() {
  const { ref, revealed } = useReveal(0.3);

  return (
    <section className="py-24 md:py-32">
      <div className="lp-shell">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="lp-eyebrow">Semainier</p>
          <h2 className="lp-title mt-2">La semaine de ton enfant, d&apos;un coup d&apos;œil.</h2>
          <p className="text-muted-foreground mt-4">
            Humeur, sieste, activités, météo. Un journal continu que les deux parents
            remplissent — et des tendances qui apparaissent sur le mois.
          </p>
        </Reveal>

        <div ref={ref} className="grid grid-cols-7 gap-1.5 sm:gap-3 mt-12 max-w-3xl mx-auto">
          {WEEK.map((entry, i) => (
            <div
              key={entry.day}
              data-revealed={revealed}
              className="lp-day lp-card p-2 sm:p-4 text-center"
              style={{ ["--delay" as string]: `${i * 60}ms` }}
            >
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                {entry.day}
              </p>
              <p className="text-xl sm:text-3xl mt-1.5 sm:mt-3">{entry.mood}</p>
              <p className="text-sm sm:text-lg mt-1">{entry.weather}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 7. The assistant ── */

export function AssistantSection() {
  const { ref, revealed } = useReveal(0.4);
  const typed = useTypewriter(
    "Ajoute la blanquette de jeudi à la liste de courses",
    revealed
  );
  const done = typed.length > 46;

  return (
    <section className="py-24 md:py-32 lp-alt">
      <div className="lp-shell max-w-3xl">
        <Reveal className="text-center">
          <p className="lp-eyebrow">Assistant</p>
          <h2 className="lp-title mt-2">Ou demande-le, simplement.</h2>
          <p className="text-muted-foreground mt-4">
            MindDump expose un serveur MCP : ton assistant IA peut lire et écrire dans l&apos;app
            à ta place.
          </p>
        </Reveal>

        <div ref={ref} className="lp-card mt-10 overflow-hidden font-mono text-sm">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-[hsl(220_14%_98%)]">
            {["hsl(0 72% 62%)", "hsl(40 90% 58%)", "hsl(142 50% 50%)"].map((tint) => (
              <span
                key={tint}
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: tint }}
              />
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
      </div>
    </section>
  );
}

/* ── 8. Final call to action ── */

export function CtaSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="lp-shell">
        <Reveal>
          <div className="rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 px-6 py-16 sm:px-12 sm:py-20 text-center">
            <h2 className="text-white font-bold tracking-tight text-[clamp(1.9rem,4.6vw,3.1rem)] leading-tight">
              Arrête d&apos;être le seul cerveau du foyer.
            </h2>
            <p className="text-white/90 mt-4 max-w-lg mx-auto">
              Crée ton espace, invite ta famille, et vide ta charge mentale une bonne fois.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link
                href="/register"
                className="rounded-xl bg-white text-[hsl(24_85%_45%)] font-semibold px-7 py-3.5 hover:bg-white/90 transition-colors"
              >
                Créer un compte
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/40 text-white font-semibold px-7 py-3.5 hover:bg-white/10 transition-colors"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </Reveal>

        <p className="text-center text-xs text-muted-foreground mt-10">
          MindDump — vide ta charge mentale.
        </p>
      </div>
    </section>
  );
}
