import { ArrowRight, Bell, RefreshCw, LogIn, Share2, SlidersHorizontal, Sun } from "lucide-react";
import SpotlightCard from "./SpotlightCard";

const SPOT = { theme: "dark" as const, spotlightColor: "#F97316", intensity: 0.22, spotlightSize: 300, borderGlow: 0.9, ambient: false };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <SpotlightCard {...SPOT} className={`lp2-bento-card ${className}`} style={{ padding: "1.5rem", background: "hsl(222 20% 13%)" }}>
      {children}
    </SpotlightCard>
  );
}

export function Bento() {
  return (
    <section className="lp2-dark on-dark py-20 md:py-32" aria-labelledby="lp2-bento-h">
      <div className="lp2-shell">
        <div className="max-w-3xl" data-reveal>
          <p className="lp2-eyebrow">À la carte</p>
          <h2 id="lp2-bento-h" className="lp2-h2 mt-4">
            Et tout ce qu&apos;il faut autour, sans rien imposer.
          </h2>
          <p className="lp2-lead mt-5 max-w-2xl">
            Chaque module s&apos;active ou se désactive depuis ton profil. Tu ne gardes que ce que tu utilises.
          </p>
        </div>

        <div className="lp2-bento mt-12" data-bento>
          <div data-reveal>
            <Card>
              <span className="lp2-ico"><SlidersHorizontal className="h-5 w-5" aria-hidden="true" /></span>
              <h3>Seulement les modules dont tu as besoin</h3>
              <p>Tâches, calendrier, courses, recettes, semainier : active-les un par un. L&apos;app se réduit à ce que tu utilises.</p>
              <div className="mt-5 grid gap-2" data-mock aria-hidden="true">
                {[["Recettes et courses", true], ["Calendrier", true], ["Semainier enfant", false]].map(([l, on], i) => (
                  <div key={l as string} className="lp2-tg">
                    {l}
                    <span className={`lp2-sw a-sw ${on ? "on" : ""}`} style={{ ["--d" as string]: `${0.3 + i * 0.25}s` } as React.CSSProperties} />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div data-reveal>
            <Card>
              <span className="lp2-ico"><RefreshCw className="h-5 w-5" aria-hidden="true" /></span>
              <h3>Des agendas qui se parlent</h3>
              <p>Abonne-toi aux calendriers de l&apos;école ou du club (iCal), et exporte celui du foyer en .ics vers Google ou Apple Agenda.</p>
              <div className="mt-5 flex flex-wrap items-center gap-2" aria-hidden="true">
                <span className="lp2-pill">Calendrier de l&apos;école</span>
                <ArrowRight className="h-4 w-4 text-[hsl(var(--or))]" />
                <span className="lp2-pill" style={{ background: "hsl(var(--or))", color: "hsl(var(--ink))", borderColor: "transparent" }}>MindDump</span>
                <ArrowRight className="h-4 w-4 text-[hsl(var(--or))]" />
                <span className="lp2-pill">Google · Apple Agenda</span>
              </div>
            </Card>
          </div>

          <div data-reveal>
            <Card>
              <span className="lp2-ico"><Sun className="h-5 w-5" aria-hidden="true" /></span>
              <h3>La météo dès l&apos;accueil</h3>
              <p>Avant de sortir, un coup d&apos;œil : le temps du jour, à côté de ce qui t&apos;attend.</p>
            </Card>
          </div>

          <div data-reveal>
            <Card>
              <span className="lp2-ico"><Bell className="h-5 w-5" aria-hidden="true" /></span>
              <h3>Des rappels pour tout le monde</h3>
              <p>Par e-mail, et en notification sur Android ou sur iPhone une fois l&rsquo;app installée sur l&rsquo;écran d&rsquo;accueil : le rappel part à chaque membre du foyer.</p>
            </Card>
          </div>

          <div data-reveal>
            <Card>
              <span className="lp2-ico"><Share2 className="h-5 w-5" aria-hidden="true" /></span>
              <h3>Partage depuis les autres apps</h3>
              <p>Un lien de recette, une adresse, une idée : envoie-les vers MindDump depuis le menu Partager du téléphone.</p>
            </Card>
          </div>

          <div data-reveal>
            <Card>
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <span className="lp2-ico"><LogIn className="h-5 w-5" aria-hidden="true" /></span>
                  <h3>Une inscription qui prend une minute</h3>
                  <p>Connecte-toi avec Google, avec Apple ou par e-mail, puis invite ton foyer avec un lien. Les enfants et les adultes sans compte sont des profils du groupe : ils n&apos;ont rien à créer.</p>
                </div>
                <div className="flex flex-wrap gap-2" aria-hidden="true">
                  <span className="lp2-pill">Continuer avec Google</span>
                  <span className="lp2-pill">Continuer avec Apple</span>
                  <span className="lp2-pill">E-mail</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
