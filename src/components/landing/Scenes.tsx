import { Check } from "lucide-react";
import { AssistantMock, EverywhereMock, HouseholdMock, LoopMock } from "./Mockups";

type Scene = {
  id: string;
  num: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  note?: string;
  tint: string;
  Mock: () => React.JSX.Element;
};

const SCENES: Scene[] = [
  {
    id: "boucle",
    num: "01",
    eyebrow: "Repas et courses",
    title: "La recette du matin est déjà dans ta liste de courses.",
    body: "Colle le lien d'une recette HelloFresh, Jow ou Quitoque : ingrédients, temps et portions arrivent entiers. Un geste, et la liste de courses est faite. Au magasin, vous cochez à deux, chacun dans son rayon.",
    points: [
      "Menus de la semaine planifiés recette par recette",
      "Liste de courses partagée, cochée en temps réel",
      "Mode cuisine plein écran : l'écran reste allumé",
      "Connecteurs aux drives en ligne : ta liste remplit ton panier",
    ],
    tint: "var(--peach)",
    Mock: LoopMock,
  },
  {
    id: "foyer",
    num: "02",
    eyebrow: "Agenda et tâches",
    title: "Tout le foyer voit le même agenda.",
    body: "Un rendez-vous, une tâche, une échéance qui revient chaque année : notés une fois, visibles par tous. Abonne le foyer au calendrier de l'école ou du club, et retrouve le tien dans Google ou Apple Agenda.",
    points: [
      "Tâches avec priorités, échéances et personnes assignées",
      "Abonnements iCal en entrée, flux .ics en sortie",
      "Échéances annuelles : assurance, contrôle technique",
      "Rappel envoyé à chaque membre du groupe",
    ],
    tint: "var(--sage)",
    Mock: HouseholdMock,
  },
  {
    id: "assistant",
    num: "03",
    eyebrow: "Assistant IA",
    title: "Ton assistant écrit directement dans l'app.",
    body: "Branche Claude, ou tout assistant compatible MCP, à ton espace. Envoie-lui la photo d'une recette, dis-lui de la planifier : il crée la fiche, la place dans ta semaine et prépare les courses. Tu relis, tu gardes la main.",
    points: [
      "Création de tâches, recettes, événements et listes",
      "Import des recettes HelloFresh, Jow et Quitoque",
      "Import par IA d'un planning depuis une photo ou un PDF",
    ],
    note: "Le geste passe par ton assistant : l'app n'embarque pas d'appareil photo.",
    tint: "var(--butter)",
    Mock: AssistantMock,
  },
  {
    id: "quotidien",
    num: "04",
    eyebrow: "Au quotidien",
    title: "Dans la cuisine, sur le mur, dans la poche.",
    body: "Une tablette au mur affiche la semaine, la météo et les courses du foyer. Les petits ont leur semainier à gros boutons. Sur ton téléphone, des rappels, et un menu Partager pour envoyer une recette ou un lien vers MindDump depuis n'importe quelle app.",
    points: [
      "Écran mural pour tablette, avec veille de nuit",
      "Mode enfant : semainier humeur, sieste, activités",
      "Rappels sur Android, et sur iPhone une fois installée sur l'écran d'accueil",
      "Installable sur l'écran d'accueil",
    ],
    tint: "var(--sky)",
    Mock: EverywhereMock,
  },
];

export function Scenes() {
  return (
    <section className="py-20 md:py-32" aria-labelledby="lp2-scenes-h">
      <div className="lp2-shell">
        <div className="max-w-3xl" data-reveal>
          <p className="lp2-eyebrow">Ce que ça change</p>
          <h2 id="lp2-scenes-h" className="lp2-h2 mt-4">
            Quatre gestes qui sortent la liste de ta tête.
          </h2>
          <p className="lp2-lead mt-5 max-w-2xl">
            Pas un gestionnaire de plus à remplir : chaque écran retire du travail au lieu d&apos;en ajouter.
          </p>
        </div>

        <div className="lp2-scenes mt-12 md:mt-16" data-scenes>
          {SCENES.map((s, i) => (
            <article
              key={s.id}
              id={s.id}
              className="lp2-scene"
              data-scene
              style={{ ["--i" as string]: i, scrollMarginTop: "5rem" } as React.CSSProperties}
            >
              <div className="lp2-scene-inner">
                <div className="lp2-scene-copy">
                  <p className="lp2-scene-num">
                    {s.num} <span className="lp2-eyebrow ml-2">{s.eyebrow}</span>
                  </p>
                  <h3 className="lp2-scene-title">{s.title}</h3>
                  <p className="lp2-lead mt-4">{s.body}</p>
                  <ul className="lp2-checks">
                    {s.points.map((p) => (
                      <li key={p}>
                        <Check className="h-[1.05rem] w-[1.05rem]" strokeWidth={3} aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  {s.note && <p className="lp2-note-fine">{s.note}</p>}
                </div>
                <div className="lp2-panel" style={{ ["--tint" as string]: s.tint } as React.CSSProperties}>
                  <s.Mock />
                  <span className="lp2-caption">Interface de l&apos;app, données d&apos;exemple</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
