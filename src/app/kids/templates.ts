import type { KidIconId } from "@/lib/kidIconIds";
import type { KidTrackerKind } from "@/lib/kidWeek";

/**
 * Idées de départ, uniquement neutres (météo, humeur, activités). Aucune
 * rubrique à connotation santé n'est proposée : le parent compose sa propre vue.
 */
export interface TrackerTemplate {
  id: string;
  label: string;
  icon: KidIconId;
  kind: KidTrackerKind;
  options: Array<{ label: string; icon: KidIconId }>;
}

export const TRACKER_TEMPLATES: TrackerTemplate[] = [
  {
    id: "meteo",
    label: "Météo",
    icon: "sun",
    kind: "single",
    options: [
      { label: "Soleil", icon: "sun" },
      { label: "Éclaircies", icon: "sun-cloud" },
      { label: "Nuages", icon: "cloud" },
      { label: "Pluie", icon: "rain" },
      { label: "Orage", icon: "storm" },
      { label: "Neige", icon: "snow" },
    ],
  },
  {
    id: "humeur",
    label: "Humeur",
    icon: "face-happy",
    kind: "single",
    options: [
      { label: "Très content", icon: "face-very-happy" },
      { label: "Content", icon: "face-happy" },
      { label: "Bof", icon: "face-neutral" },
      { label: "Triste", icon: "face-sad" },
      { label: "Fâché", icon: "face-angry" },
    ],
  },
  {
    id: "activites",
    label: "Activités",
    icon: "star",
    kind: "multi",
    options: [
      { label: "Peinture", icon: "brush" },
      { label: "Lecture", icon: "book" },
      { label: "Sport", icon: "ball" },
      { label: "Musique", icon: "music" },
      { label: "Puzzle", icon: "puzzle" },
      { label: "Parc", icon: "tree" },
      { label: "Cuisine", icon: "pan" },
      { label: "Piscine", icon: "wave" },
      { label: "Copains", icon: "people" },
      { label: "Bricolage", icon: "scissors" },
      { label: "Animaux", icon: "paw" },
      { label: "Déguisement", icon: "mask" },
    ],
  },
];

export const KIND_LABELS: Record<KidTrackerKind, string> = {
  single: "Choix unique",
  multi: "Choix multiples",
  count: "Compteur",
};

export const KIND_HINTS: Record<KidTrackerKind, string> = {
  single: "Une seule réponse par jour (par exemple la météo).",
  multi: "Plusieurs réponses possibles le même jour (par exemple des activités).",
  count: "Un nombre de 0 à 99 (par exemple des verres d'eau, des livres lus).",
};
