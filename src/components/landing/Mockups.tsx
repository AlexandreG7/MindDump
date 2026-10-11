import {
  Bell,
  CalendarDays,
  Check,
  ChefHat,
  Cloud,
  Repeat,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Sun,
  Moon,
  Palette,
  Smile,
  Wand2,
} from "lucide-react";

const v = (o: Record<string, string | number>) => o as React.CSSProperties;

/* Maquettes d'interface : l'UI de l'app redessinée en code, avec des données
   d'exemple (jamais de fausses captures). Tout est aria-hidden : le texte
   explicatif est dans la carte voisine. */

/* 1 · Recette → courses → panier */
const INGREDIENTS = ["Courgettes · 800 g", "Crème fraîche · 20 cl", "Gruyère râpé · 100 g", "Ail · 2 gousses", "Œufs · 2", "Beurre · 20 g"];

export function LoopMock() {
  return (
    <div className="mk" data-mock aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-[1fr_0.95fr]">
        <div className="mk-card overflow-hidden a-pop" style={v({ "--d": "0.1s" })}>
          <div className="relative grid h-24 place-items-center" style={{ background: "linear-gradient(135deg,#fdba74,#f97316 70%,#ea580c)" }}>
            <ChefHat className="h-9 w-9" style={{ color: "hsl(24 40% 8%)" }} />
            <span className="mk-chip a-pop absolute left-2 top-2" style={v({ "--d": "0.7s", background: "#fff" })}>
              <Check className="h-3 w-3" /> Importée depuis Jow
            </span>
          </div>
          <div className="p-3">
            <p className="font-extrabold" style={{ fontSize: "0.95rem", letterSpacing: "-0.02em" }}>Gratin de courgettes</p>
            <p className="mk-muted mt-0.5">35 min · 4 portions</p>
            <div className="mt-2 grid gap-1">
              {INGREDIENTS.map((t, i) => (
                <p key={t} className="a-slide mk-muted" style={v({ "--d": `${1.1 + i * 0.14}s`, "--x": "-14px" })}>
                  · {t}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mk-card p-3 a-pop" style={v({ "--d": "0.5s" })}>
          <p className="mk-h"><ShoppingCart className="h-3.5 w-3.5" style={{ color: "hsl(25 95% 42%)" }} /> Courses de la semaine</p>
          <div className="mt-1">
            {INGREDIENTS.map((t, i) => {
              const done = i < 4;
              return (
                <div key={t} className="mk-row a-slide" style={v({ "--d": `${1.9 + i * 0.22}s`, "--x": "-34px" })}>
                  <span className={`mk-check ${done ? "on" : ""}`}>
                    {done && <Check className="a-tick h-3 w-3" strokeWidth={4} style={v({ "--d": `${3.4 + i * 0.28}s` })} />}
                  </span>
                  <span className={`${done ? "mk-done a-strike" : ""} font-semibold`} style={v({ "--d": `${3.4 + i * 0.28}s` })}>{t.split(" · ")[0]}</span>
                </div>
              );
            })}
          </div>
          <div className="mk-bar mt-2"><i className="a-fill" style={v({ "--w": "66%", "--d": "3.4s" })} /></div>
        </div>
      </div>

      <div className="mk-card mt-3 flex items-center gap-3 p-3 a-pop" style={v({ "--d": "4.7s" })}>
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "hsl(25 95% 53%)" }}>
          <ShoppingCart className="h-4 w-4" style={{ color: "hsl(24 40% 8%)" }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Panier Match prêt à remplir</p>
          <p className="mk-muted">6 articles, un produit proposé pour chacun</p>
        </div>
        <span className="mk-chip ok">Revoir</span>
      </div>
    </div>
  );
}

/* 2 · Le foyer partage agenda et tâches */
export function HouseholdMock() {
  const EVENTS = [
    { d: "jeu.", t: "15:00", n: "rdv pédiatre", s: "Ajouté par Camille", c: "#ec4899", i: "C" },
    { d: "ven.", t: "18:00", n: "Réunion parents", s: "Calendrier de l'école", c: "#14b8a6", i: "", sub: true },
    { d: "lun.", t: "échéance", n: "Relancer le plombier", s: "Tâche · assignée à Marc", c: "#f97316", i: "M" },
    { d: "15 mars", t: "chaque année", n: "Assurance habitation", s: "Échéance annuelle", c: "#8b5cf6", i: "", yearly: true },
  ];
  return (
    <div className="mk" data-mock aria-hidden="true">
      <div className="mk-card p-3.5">
        <div className="flex items-center justify-between">
          <p className="mk-h"><CalendarDays className="h-4 w-4" style={{ color: "hsl(25 95% 42%)" }} /> Cette semaine, pour tout le foyer</p>
          <div className="flex -space-x-1.5">
            {[["C", "#ec4899"], ["M", "#f97316"], ["A", "#14b8a6"]].map(([l, c]) => (
              <span key={l} className="mk-av" style={{ background: c, border: "2px solid #fff" }}>{l}</span>
            ))}
          </div>
        </div>
        <div className="mt-2">
          {EVENTS.map((e, i) => (
            <div key={e.n} className="mk-row a-slide" style={v({ "--d": `${0.2 + i * 0.35}s`, "--x": "22px" })}>
              <span className="h-9 w-1.5 rounded-full" style={{ background: e.c }} />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{e.n}</p>
                <p className="mk-muted flex items-center gap-1">
                  {e.sub && <RefreshCw className="h-3 w-3" />}
                  {e.yearly && <Repeat className="h-3 w-3" />}
                  {e.s}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{e.d}</p>
                <p className="mk-muted" style={{ fontSize: "0.66rem" }}>{e.t}</p>
              </div>
              {e.i && <span className="mk-av" style={{ background: e.c }}>{e.i}</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="mk-card mt-3 flex items-center gap-3 p-3 a-pop" style={v({ "--d": "2.1s" })}>
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "hsl(150 40% 90%)" }}>
          <Bell className="h-4 w-4" style={{ color: "hsl(150 55% 24%)" }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Rappel envoyé au foyer</p>
          <p className="mk-muted">rdv pédiatre, jeudi 15:00 : Camille, Marc, Alexandre</p>
        </div>
      </div>
    </div>
  );
}

/* 3 · L'assistant (Claude via MCP) */
const ASK = "Voici la recette de Léa en photo. Ajoute-la à mon catalogue, planifie-la jeudi soir et prépare les courses.".split(" ");

export function AssistantMock() {
  return (
    <div className="mk" data-mock aria-hidden="true">
      <div className="mk-card overflow-hidden">
        <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: "hsl(220 14% 92%)" }}>
          <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ background: "hsl(260 80% 94%)" }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(262 55% 38%)" }} />
          </span>
          <p className="mk-h">Ton assistant</p>
          <span className="mk-chip ml-auto">connecté à MindDump</span>
        </div>

        <div className="grid gap-2.5 p-3.5">
          <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md p-2.5 a-pop" style={v({ "--d": "0.2s", background: "hsl(222 26% 11%)", color: "#fff" })}>
            <div className="relative mb-2 overflow-hidden rounded-lg" style={{ background: "#fffaf0", height: "4.4rem", padding: "0.5rem 0.6rem" }}>
              <div className="h-2 w-2/3 rounded" style={{ background: "#d6c9b4" }} />
              {[90, 80, 86, 62].map((w, i) => (
                <div key={i} className="mt-1.5 h-1.5 rounded" style={{ width: `${w}%`, background: "#e8dfcf" }} />
              ))}
              <span className="a-scan absolute left-0 right-0 top-0 h-6" style={v({ "--d": "0.6s", background: "linear-gradient(180deg,transparent,hsl(25 95% 53% / 0.55),transparent)" })} />
            </div>
            <p style={{ lineHeight: 1.45 }}>
              {ASK.map((w, i) => (
                <span key={i} className="a-word inline-block" style={v({ "--d": `${1 + i * 0.07}s` })}>{w}&nbsp;</span>
              ))}
            </p>
          </div>

          <div className="grid gap-1.5">
            {[
              ["create_recipe", "Gratin de courgettes créé", 2.9],
              ["plan_meal", "Planifié jeudi soir", 3.5],
              ["recipe_to_shopping_list", "6 ingrédients dans tes courses", 4.1],
            ].map(([fn, label, d]) => (
              <div key={fn as string} className="mk-card flex items-center gap-2 px-2.5 py-2 a-slide" style={v({ "--d": `${d}s`, "--x": "-18px", boxShadow: "none" })}>
                <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: "hsl(150 40% 90%)" }}>
                  <Check className="h-3 w-3" strokeWidth={3.5} style={{ color: "hsl(150 55% 24%)" }} />
                </span>
                <code style={{ fontSize: "0.68rem", fontWeight: 700, color: "hsl(262 40% 32%)" }}>{fn}</code>
                <span className="mk-muted ml-auto">{label}</span>
              </div>
            ))}
          </div>

          <p className="a-pop rounded-2xl rounded-bl-md p-2.5" style={v({ "--d": "4.8s", background: "hsl(220 16% 95%)", lineHeight: 1.45 })}>
            C&apos;est fait. La recette est dans ton catalogue, au menu de jeudi, et la liste de courses est prête.
          </p>
        </div>
      </div>
    </div>
  );
}

/* 4 · Dans toute la maison : écran mural + mode enfant + rappel */
export function EverywhereMock() {
  const DAYS = [
    { d: "mer.", ev: [] as { n: string; c: string }[] },
    { d: "jeu.", today: true, ev: [{ n: "15:00 Pédiatre", c: "#ec4899" }, { n: "Gratin", c: "#f97316" }] },
    { d: "ven.", ev: [{ n: "18:00 Réunion", c: "#14b8a6" }] },
    { d: "sam.", ev: [{ n: "Natation", c: "#8b5cf6" }] },
  ];
  return (
    <div className="mk relative" style={{ maxWidth: "31rem" }} data-mock aria-hidden="true">
      <div className="mk-tablet a-pop" style={v({ "--d": "0.1s" })}>
        <div className="mk-tablet-screen">
          <div className="flex items-end justify-between">
            <div>
              <p style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>18:42</p>
              <p style={{ fontSize: "0.68rem", opacity: 0.7 }}>jeudi 12 mars</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "hsl(222 18% 20%)", fontSize: "0.7rem", fontWeight: 700 }}>
              <Cloud className="h-3.5 w-3.5" /> 11°
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {DAYS.map((day, i) => (
              <div key={day.d} className={`mk-day ${day.today ? "today" : ""} a-pop`} style={v({ "--d": `${0.5 + i * 0.15}s` })}>
                <b>{day.d}</b>
                {day.ev.map((e) => (
                  <p key={e.n} className="mk-ev" style={v({ "--c": e.c })}>{e.n}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1.15fr_1fr] gap-3">
        <div className="mk-card p-3 a-pop" style={v({ "--d": "1.4s" })}>
          <p className="mk-h"><Smile className="h-3.5 w-3.5" style={{ color: "hsl(25 95% 42%)" }} /> Mode enfant</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              { l: "Humeur", i: Sun, bg: "#fde68a" },
              { l: "Sieste", i: Moon, bg: "#c7d2fe" },
              { l: "Activité", i: Palette, bg: "#fbcfe8" },
            ].map((b) => (
              <span key={b.l} className="mk-kid-btn" style={v({ "--bg": b.bg })}>
                <b.i className="h-5 w-5" />
                {b.l}
              </span>
            ))}
          </div>
        </div>
        <div className="mk-card flex items-start gap-2 p-3 a-pop" style={v({ "--d": "2s" })}>
          <span className="grid h-7 w-7 flex-none place-items-center rounded-lg" style={{ background: "hsl(25 95% 53%)" }}>
            <Bell className="h-3.5 w-3.5" style={{ color: "hsl(24 40% 8%)" }} />
          </span>
          <div>
            <p className="font-extrabold">Demain 15:00</p>
            <p className="mk-muted">rdv pédiatre</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Magic() {
  return <Wand2 className="h-4 w-4" aria-hidden="true" />;
}
