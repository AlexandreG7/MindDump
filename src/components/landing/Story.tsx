import { Calendar, CheckSquare, ChefHat, ShoppingCart, Sparkles } from "lucide-react";

/* ── Bandeau : ce à quoi MindDump se branche (texte seul, pas de logos) ── */
const SOURCES = [
  "HelloFresh",
  "Jow",
  "Quitoque",
  "Google Agenda",
  "Apple Agenda",
  "Drive Match",
  "Claude",
  "Google",
  "Apple",
];

export function Marquee() {
  const group = (hidden: boolean) => (
    <ul className="lp2-marquee-group" aria-hidden={hidden || undefined}>
      {SOURCES.map((s) => (
        <li key={s} className="lp2-marquee-item">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {s}
        </li>
      ))}
    </ul>
  );
  return (
    <section className="lp2-marquee" aria-label="MindDump se branche sur les services que tu utilises déjà">
      <div className="lp2-shell flex items-center gap-6 py-0">
        <p className="hidden shrink-0 py-4 text-sm font-semibold text-[hsl(var(--mute))] lg:block">
          Il se branche sur ce que tu utilises déjà
        </p>
        <div className="lp2-marquee-mask min-w-0 flex-1 overflow-hidden">
          <div className="lp2-marquee-track">
            {group(false)}
            {group(true)}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Chaos → ordre : l'ordre est l'état par défaut (HTML), GSAP défait puis
   rejoue le chaos en scrub (LandingMotion). Les notes manuscrites ne servent
   qu'ici, pour matérialiser la charge mentale. ── */
const COLUMNS = [
  {
    title: "Tâches",
    icon: CheckSquare,
    items: [
      { note: "relancer le plombier", row: "Relancer le plombier", who: "#f97316", tag: "M" },
      { note: "vaccin du chat", row: "Vaccin du chat", who: "#14b8a6", tag: "A" },
      { note: "cadeau anniv Léo", row: "Cadeau anniv Léo", who: "#8b5cf6", tag: "S" },
    ],
  },
  {
    title: "Courses & repas",
    icon: ShoppingCart,
    items: [
      { note: "acheter du pain", row: "Du pain", who: "#f97316", tag: "6/9" },
      { note: "lessive + pharmacie", row: "Lessive, pharmacie", who: "#14b8a6", tag: "" },
      { note: "on mange quoi jeudi ?", row: "Jeudi : gratin de courgettes", who: "#ec4899", tag: "" },
    ],
  },
  {
    title: "Agenda",
    icon: Calendar,
    items: [
      { note: "rdv pédiatre jeudi", row: "Rdv pédiatre", who: "#ec4899", tag: "jeu. 15:00" },
      { note: "réunion parents 18h", row: "Réunion parents", who: "#14b8a6", tag: "ven. 18:00" },
      { note: "renouveler le passeport", row: "Renouveler le passeport", who: "#8b5cf6", tag: "échéance" },
    ],
  },
];

const DECOR = [
  { t: "penser aux clés !", x: "6%", y: "20%", r: -8 },
  { t: "anniv mamie ?", x: "min(70%, calc(100% - 9.5rem))", y: "16%", r: 7 },
  { t: "RDV dentiste??", x: "min(76%, calc(100% - 9.5rem))", y: "58%", r: -5 },
  { t: "où est le carnet de santé", x: "4%", y: "70%", r: 6 },
  { t: "inscription natation", x: "min(52%, calc(100% - 12rem))", y: "82%", r: -9 },
];

export function Chaos() {
  return (
    <section className="lp2-dark lp2-chaos on-dark" data-chaos aria-labelledby="lp2-chaos-h">
      <div className="lp2-chaos-stage" data-chaos-stage>
        {DECOR.map((d) => (
          <span key={d.t} className="lp2-decor" data-decor aria-hidden="true" style={{ left: d.x, top: d.y, transform: `rotate(${d.r}deg)` }}>
            {d.t}
          </span>
        ))}
        <div className="lp2-shell relative z-[1] w-full">
          <p className="lp2-eyebrow">Le problème</p>
          <h2 id="lp2-chaos-h" className="lp2-h2 mt-4 max-w-[15ch] sm:max-w-[19ch] lg:max-w-[24ch]">
            <span data-chaos-lead>Une semaine dans ta tête.</span>{" "}
            <span className="range" data-chaos-range>
              MindDump la range.
            </span>
          </h2>
          <p className="lp2-lead mt-4 max-w-xl text-[0.95rem] sm:text-base">
            Un rendez-vous, une échéance, un « on mange quoi ? » : chaque chose notée une fois, au bon endroit,
            et visible de toute la famille.
          </p>

          <div className="lp2-board" data-board>
            {COLUMNS.map((col) => (
              <div key={col.title} className="lp2-col">
                <p className="lp2-col-head">
                  <span className="ic">
                    <col.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {col.title}
                </p>
                <ul>
                  {col.items.map((it) => (
                    <li key={it.row} className="lp2-item" data-item>
                      <span className="lp2-note" data-note aria-hidden="true">
                        {it.note}
                      </span>
                      <span className="lp2-row" data-row>
                        <span className="dot" style={{ ["--c" as string]: it.who }} aria-hidden="true" />
                        {it.row}
                        {it.tag && <small>{it.tag}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
