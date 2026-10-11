import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  Check,
  ChefHat,
  CheckSquare,
  Home,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";

function W({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <span className="lp2-w" style={{ "--i": i } as React.CSSProperties}>
      {children}
    </span>
  );
}

function PhoneApp() {
  return (
    <div className="lp2-phone-screen">
      <div className="flex items-start justify-between">
        <div>
          <p className="mk-muted" style={{ fontSize: "0.58rem" }}>
            jeudi 12 mars
          </p>
          <p className="font-extrabold" style={{ fontSize: "0.95rem", letterSpacing: "-0.02em" }}>
            Bonjour Alexandre
          </p>
        </div>
        <span className="mk-chip" style={{ background: "hsl(45 90% 90%)", color: "hsl(35 80% 25%)" }}>
          <Sun className="h-3 w-3" />
          14°
        </span>
      </div>

      <div className="mk-card" style={{ padding: "0.55rem 0.65rem" }}>
        <p className="mk-h" style={{ fontSize: "0.7rem" }}>
          <CheckSquare className="h-3 w-3" style={{ color: "hsl(25 95% 45%)" }} />
          À faire ce soir
        </p>
        <div className="mt-1">
          {[
            { t: "Sortir le linge", c: "#14b8a6", i: "A", done: true, d: "1.6s" },
            { t: "Relancer le plombier", c: "#f97316", i: "M", done: true, d: "2.6s" },
            { t: "Réserver le pédiatre", c: "#ec4899", i: "C", done: false, d: "0s" },
          ].map((r) => (
            <div key={r.t} className="mk-row" style={{ padding: "0.4rem 0.1rem" }}>
              <span className={`mk-check ${r.done ? "on" : ""}`} style={{ width: "0.9rem", height: "0.9rem" }}>
                {r.done && <Check className="a-tick h-2.5 w-2.5" strokeWidth={4} style={{ ["--d" as string]: r.d }} />}
              </span>
              <span className={`${r.done ? "mk-done a-strike" : ""} font-semibold`} style={{ ["--d" as string]: r.d }}>
                {r.t}
              </span>
              <span className="mk-av ml-auto" style={{ background: r.c, width: "1.1rem", height: "1.1rem", fontSize: "0.55rem" }}>
                {r.i}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mk-card" style={{ padding: "0.55rem 0.65rem" }}>
        <p className="mk-h" style={{ fontSize: "0.7rem" }}>
          <ChefHat className="h-3 w-3" style={{ color: "hsl(25 95% 45%)" }} />
          Au menu
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="grid place-items-center rounded-lg"
            style={{ width: "2rem", height: "2rem", background: "linear-gradient(135deg,#fdba74,#f97316)" }}
          >
            <ChefHat className="h-4 w-4" style={{ color: "hsl(24 40% 8%)" }} />
          </span>
          <div>
            <p className="font-bold">Gratin de courgettes</p>
            <p className="mk-muted" style={{ fontSize: "0.58rem" }}>
              35 min · 4 portions
            </p>
          </div>
        </div>
      </div>

      <div className="mk-card" style={{ padding: "0.55rem 0.65rem" }}>
        <div className="flex items-center justify-between">
          <p className="mk-h" style={{ fontSize: "0.7rem" }}>
            <ShoppingCart className="h-3 w-3" style={{ color: "hsl(25 95% 45%)" }} />
            Courses
          </p>
          <span className="font-bold" style={{ fontSize: "0.62rem" }}>
            6 / 9
          </span>
        </div>
        <div className="mk-bar mt-1.5">
          <i className="a-fill" style={{ ["--w" as string]: "66%", ["--d" as string]: "0.8s" }} />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-around rounded-2xl bg-white py-1.5" style={{ border: "1px solid hsl(220 14% 92%)" }}>
        {[Home, CheckSquare, Calendar, ShoppingCart, ChefHat].map((Icon, k) => (
          <Icon key={k} className="h-3.5 w-3.5" style={{ color: k === 0 ? "hsl(25 95% 45%)" : "hsl(220 9% 55%)" }} />
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="lp2-hero" aria-labelledby="lp2-h1">
      <div className="lp2-mesh" aria-hidden="true">
        <span className="lp2-blob lp2-blob-a" />
        <span className="lp2-blob lp2-blob-b" />
        <span className="lp2-blob lp2-blob-c" />
        <span className="lp2-grain" />
      </div>

      <div className="lp2-shell relative grid items-center gap-10 pb-14 pt-4 md:pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:pb-16 lg:pt-8">
        <div>
          <p className="lp2-enter lp2-eyebrow" style={{ ["--d" as string]: "0ms" }}>
            Repas · courses · tâches · agenda
          </p>

          <h1 id="lp2-h1" className="lp2-h1 mt-5">
            <span className="line">
              <W i={0}>Vide</W> <W i={1}>ta</W>
            </span>
            <span className="line">
              <W i={2}>charge</W>
            </span>
            <span className="line">
              <W i={3}>
                <span className="lp2-underline">
                  mentale.
                  <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M4 16 C 60 4, 120 22, 176 11 S 262 6, 296 14" pathLength={420} />
                  </svg>
                </span>
              </W>
            </span>
          </h1>

          <p className="lp2-lead lp2-enter mt-6 max-w-[34rem]" style={{ ["--d" as string]: "450ms" }}>
            MindDump range les repas, les courses, les tâches et le calendrier de toute la famille
            au même endroit. Et ton assistant IA les remplit à ta place, pour que plus personne
            n&apos;ait à tout retenir.
          </p>

          <div className="lp2-enter mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ ["--d" as string]: "560ms" }}>
            <Link href="/register" className="lp2-btn lp2-btn-or !min-h-[3.4rem] !px-8 !text-[1.02rem]">
              Créer mon espace
              <ArrowRight className="arrow h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
            </Link>
            <Link href="/login" className="lp2-btn lp2-btn-ghost !min-h-[3.4rem]">
              Se connecter
            </Link>
          </div>

          <ul className="lp2-enter mt-8 flex flex-wrap gap-x-6 gap-y-2.5" style={{ ["--d" as string]: "680ms" }}>
            {[
              { i: Users, t: "Partagé avec tout le foyer" },
              { i: Smartphone, t: "Installable sur ton téléphone" },
              { i: CalendarCheck, t: "Connexion Google ou Apple" },
            ].map((f) => (
              <li key={f.t} className="lp2-fact">
                <f.i className="h-4 w-4" aria-hidden="true" />
                {f.t}
              </li>
            ))}
          </ul>
        </div>

        {/* Appareils : décor, d'où aria-hidden. Les cartes flottantes montrent
            les trois gestes clés (agenda, courses, assistant). */}
        <div className="lp2-enter" style={{ ["--d" as string]: "300ms" }} aria-hidden="true">
          <div className="lp2-stage" data-mock>
            <div className="lp2-phone-pos">
              <div className="lp2-phone lp2-float" style={{ ["--fd" as string]: "-2s" }}>
                <PhoneApp />
              </div>
            </div>

            <div className="absolute z-10 lp2-ca" data-parallax="-30">
              <div className="a-pop" style={{ ["--d" as string]: "0.9s" }}>
              <div className="lp2-chip-card lp2-float" style={{ position: "relative", ["--fr" as string]: "-3deg", ["--fd" as string]: "-1s" }}>
                <div className="flex items-center gap-2">
                  <span className="h-8 w-1.5 rounded-full" style={{ background: "#ec4899" }} />
                  <div>
                    <p className="font-extrabold">rdv pédiatre</p>
                    <p className="mk-muted">jeu. 15:00</p>
                  </div>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 mk-muted">
                  <span className="mk-av" style={{ background: "#ec4899", width: "1.1rem", height: "1.1rem", fontSize: "0.55rem" }}>C</span>
                  Ajouté par Camille
                </p>
              </div>
              </div>
            </div>

            <div className="absolute z-10 lp2-cc" data-parallax="-55">
              <div className="a-pop" style={{ ["--d" as string]: "1.3s" }}>
              <div className="lp2-chip-card lp2-float" style={{ position: "relative", ["--fr" as string]: "3deg", ["--fd" as string]: "-3.5s" }}>
                <p className="mk-chip" style={{ background: "hsl(260 80% 95%)", color: "hsl(262 55% 32%)" }}>
                  <Sparkles className="h-3 w-3" />
                  Ajoutée par Claude
                </p>
                <p className="mt-1.5 font-extrabold">Gratin de courgettes</p>
                <p className="mk-muted">planifié jeudi soir</p>
              </div>
              </div>
            </div>

            <div className="absolute z-10 lp2-cb" data-parallax="-18">
              <div className="a-pop" style={{ ["--d" as string]: "1.7s" }}>
              <div className="lp2-chip-card lp2-float" style={{ position: "relative", ["--fr" as string]: "2deg", ["--fd" as string]: "-5s" }}>
                <p className="flex items-center justify-between font-extrabold">
                  Courses
                  <span className="mk-chip ok">6 / 9</span>
                </p>
                <div className="mk-bar mt-2">
                  <i className="a-fill" style={{ ["--w" as string]: "66%", ["--d" as string]: "2s" }} />
                </div>
                <p className="mt-1.5 mk-muted">cochées à deux</p>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
