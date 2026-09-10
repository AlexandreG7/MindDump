"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Calendar, ChefHat, ShoppingCart, Sparkles } from "lucide-react";
import { ScrollRootContext } from "./motion";
import { LoopSection } from "./LoopSection";
import { AiSection } from "./AiSection";
import { ChaosSection, CtaSection, HouseholdSection, ModulesSection } from "./Sections";

const HERO_NOTES: {
  text: string;
  top: string;
  left?: string;
  right?: string;
  rot: string;
  dur: string;
  delay: string;
}[] = [
  { text: "rdv pédiatre jeudi", top: "16%", left: "4%", rot: "-7deg", dur: "9s", delay: "0s" },
  { text: "acheter du pain", top: "26%", right: "5%", rot: "6deg", dur: "11s", delay: "1.4s" },
  { text: "on mange quoi ce soir ?", top: "68%", left: "6%", rot: "5deg", dur: "10s", delay: "0.7s" },
  { text: "relancer le plombier", top: "74%", right: "8%", rot: "-6deg", dur: "12s", delay: "2.1s" },
  { text: "cadeau anniv Léo", top: "45%", left: "1%", rot: "9deg", dur: "10.5s", delay: "1.9s" },
  { text: "vaccin du chat", top: "54%", right: "2%", rot: "-9deg", dur: "9.5s", delay: "0.4s" },
];

const PREVIEW_TILES = [
  { icon: AlertCircle, label: "tâches urgentes", value: "2", tint: "text-destructive" },
  { icon: Calendar, label: "événements", value: "3", tint: "text-primary" },
  { icon: ShoppingCart, label: "listes actives", value: "1", tint: "text-primary" },
  { icon: ChefHat, label: "recettes", value: "12", tint: "text-primary" },
];

function Header({ scrolled }: { scrolled: boolean }) {
  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-background/85 backdrop-blur-md border-b border-border" : ""
      }`}
    >
      <div className="lp-shell flex items-center justify-between h-16">
        <span className="font-bold text-lg tracking-tight">MindDump</span>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm font-medium px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap hover:bg-secondary transition-colors"
          >
            Se connecter
          </Link>
          {/* The hero carries the sign-up CTA on small screens. */}
          <Link
            href="/register"
            className="hidden sm:block text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Créer un compte
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="lp-hero">
      <div aria-hidden="true" className="absolute inset-0 hidden md:block">
        {HERO_NOTES.map((note) => (
          <span
            key={note.text}
            className="lp-note lp-note-drift"
            style={
              {
                top: note.top,
                left: note.left,
                right: note.right,
                "--rot": note.rot,
                "--dur": note.dur,
                "--delay": note.delay,
              } as React.CSSProperties
            }
          >
            {note.text}
          </span>
        ))}
      </div>

      <div className="lp-shell relative text-center py-20">
        <div className="lp-in" style={{ animationDelay: "0ms" }}>
          <span className="lp-badge">
            <Sparkles className="h-3.5 w-3.5" />
            Photographie ton frigo, l&apos;IA s&apos;occupe du dîner
          </span>
        </div>

        <h1 className="lp-h1 mt-4 lp-in" style={{ animationDelay: "90ms" }}>
          Vide ta charge mentale.
        </h1>

        <p
          className="text-lg sm:text-xl text-muted-foreground mt-5 max-w-xl mx-auto lp-in"
          style={{ animationDelay: "180ms" }}
        >
          Les repas, les courses, les tâches et le calendrier de toute la famille au même
          endroit — et un assistant IA qui les remplit à ta place. Pour que plus personne
          n&apos;ait à tout retenir.
        </p>

        <div
          className="flex flex-col sm:flex-row gap-3 justify-center mt-9 lp-in"
          style={{ animationDelay: "270ms" }}
        >
          <Link
            href="/register"
            className="rounded-xl bg-primary text-primary-foreground font-semibold px-7 py-3.5 hover:opacity-90 transition-opacity"
          >
            Commencer gratuitement
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-border bg-card font-semibold px-7 py-3.5 hover:bg-secondary transition-colors"
          >
            Se connecter
          </Link>
        </div>

        {/* Preview of the real dashboard */}
        <div
          className="mt-14 max-w-2xl mx-auto lp-in-mock"
          style={{ animationDelay: "360ms" }}
          aria-hidden="true"
        >
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.10)]">
            <div className="text-left">
              <p className="font-bold text-lg">Bonjour Alexandre</p>
              <p className="text-xs text-muted-foreground">Voici un aperçu de ta journée</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {PREVIEW_TILES.map((tile) => (
                <div key={tile.label} className="rounded-xl border border-border p-3 text-left">
                  <tile.icon className={`h-4 w-4 ${tile.tint}`} />
                  <p className="text-xl font-bold mt-2">{tile.value}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{tile.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center pb-10" aria-hidden="true">
        <span className="lp-scroll-hint" />
      </div>
    </section>
  );
}

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 24);
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <ScrollRootContext.Provider value={rootRef}>
      <div ref={rootRef} className="lp-root">
        <Header scrolled={scrolled} />
        {/* Not a <main>: the app layout already renders one around this tree. */}
        <div>
          <Hero />
          <ChaosSection />
          <LoopSection />
          <AiSection />
          <ModulesSection />
          <HouseholdSection />
          <CtaSection />
        </div>
      </div>
    </ScrollRootContext.Provider>
  );
}
