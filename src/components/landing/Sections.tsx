"use client";

import Link from "next/link";
import {
  Baby,
  Bell,
  Calendar,
  CheckSquare,
  ChefHat,
  Link2,
  RefreshCw,
  Repeat,
  ShoppingCart,
  ToggleLeft,
} from "lucide-react";
import { Reveal, useScrub } from "./motion";
import { GUIDES } from "@/lib/content/guides";

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

/* ── 5 bis. The other mental load: appointments and deadlines ──
   Deliberately calm after the two animated demos: a plain reveal, no scrub.
   The hero's "rdv pédiatre jeudi" and "relancer le plombier" notes land here,
   filed and dated. Every claim below exists in the app — keep it that way. */

const HOUSEHOLD_WEEK = [
  {
    day: "jeu.",
    time: "15:00",
    title: "rdv pédiatre",
    source: "Ajouté par Camille",
    color: "#ec4899",
  },
  {
    day: "ven.",
    time: "18:00",
    title: "Réunion parents",
    source: "Calendrier de l'école",
    color: "#14b8a6",
    subscribed: true,
  },
  {
    day: "lun.",
    time: "échéance",
    title: "relancer le plombier",
    source: "Tâche",
    color: "#f97316",
  },
  {
    day: "15 mars",
    time: "chaque année",
    title: "Assurance habitation",
    source: "Échéance annuelle",
    color: "#8b5cf6",
    yearly: true,
  },
];

const DEADLINE_PROOFS = [
  {
    icon: RefreshCw,
    title: "Rien à re-saisir",
    body: "Abonne le foyer au calendrier de l'école, du club ou à ton agenda perso : ses dates s'affichent pour tout le monde.",
  },
  {
    icon: Bell,
    title: "Le foyer prévenu, pas une seule personne",
    body: "Le rappel par e-mail part à chaque membre du groupe, pas seulement à celui qui a noté le rendez-vous.",
  },
  {
    icon: Repeat,
    title: "Ce qui revient une fois par an",
    body: "Assurance, contrôle technique, déclaration : une échéance annuelle se note une fois et revient toute seule.",
  },
  {
    icon: Calendar,
    title: "Lisible depuis ton agenda habituel",
    body: "Le calendrier du foyer s'exporte en .ics : il apparaît dans Google ou Apple Agenda. Personne n'est obligé de changer d'app.",
  },
];

export function DeadlinesSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="lp-shell grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <Reveal className="lp-reveal-left">
          <p className="lp-eyebrow">Rendez-vous et échéances</p>
          <h2 className="lp-title mt-2">L&apos;autre charge mentale&nbsp;: celle qui a une date limite.</h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Le rendez-vous pris sur ton téléphone, toute la famille le sait. Les dates du foyer
            ne vivent plus dans une seule tête — elles vivent au même endroit, et elles
            préviennent à temps.
          </p>

          <ul className="mt-8 space-y-5">
            {DEADLINE_PROOFS.map((proof) => (
              <li key={proof.title} className="flex gap-3">
                <span className="h-9 w-9 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                  <proof.icon className="h-4 w-4 text-accent-foreground" />
                </span>
                <div>
                  <p className="font-semibold text-sm">{proof.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    {proof.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="lp-reveal-right">
          <div className="lp-card p-5 sm:p-6" aria-hidden="true">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">Calendrier du foyer</p>
              <p className="text-xs text-muted-foreground">3 sources, une vue</p>
            </div>

            <ul className="mt-4 divide-y divide-border">
              {HOUSEHOLD_WEEK.map((item) => (
                <li key={item.title} className="flex items-center gap-3 py-3">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground leading-tight">
                    <span className="block font-semibold text-foreground">{item.day}</span>
                    {item.time}
                  </span>
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{item.title}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {item.subscribed && <RefreshCw className="h-3 w-3" />}
                      {item.yearly && <Repeat className="h-3 w-3" />}
                      {item.source}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-xs text-accent-foreground">
              <Bell className="h-3.5 w-3.5 shrink-0" />
              Rappel « rdv pédiatre » envoyé aux 2 membres du foyer
            </div>
          </div>
        </Reveal>
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
            recettes, les courses, les rendez-vous et les échéances deviennent communs — et la charge cesse de
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

/* ── 7. Final call to action ── */

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

        {/* Maillage interne : sans ces liens, les pages de contenu ne sont
            atteignables que par le sitemap. */}
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-12 text-sm text-muted-foreground">
          {GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/${guide.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {guide.navLabel}
            </Link>
          ))}
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Documentation
          </Link>
        </nav>

        <p className="text-center text-xs text-muted-foreground mt-8">
          MindDump — vide ta charge mentale.
        </p>
      </div>
    </section>
  );
}
