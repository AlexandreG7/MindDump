/**
 * Adaptateur TEMPORAIRE (lot L2) : fait correspondre les anciens noms d'icônes
 * du Semainier aux nouveaux identifiants neutres de la bibliothèque.
 * À supprimer au lot L3, quand l'interface lira les rubriques du parent.
 */
import { KidIcon, type KidIconId } from "@/components/kids/icons";

interface P {
  size?: number;
  className?: string;
}

const make = (id: KidIconId) =>
  function LegacyIcon(p: P) {
    return <KidIcon id={id} size={p.size} className={p.className} decorative />;
  };

export const NapYes = make("moon");
export const NapNo = make("sun");
export const DryDay = make("check");
export const AccidentDay = make("drop");

export const WEATHER_OPTIONS = [
  { id: "sunny", label: "Soleil", Icon: make("sun") },
  { id: "partly-cloudy", label: "Éclaircies", Icon: make("sun-cloud") },
  { id: "cloudy", label: "Nuages", Icon: make("cloud") },
  { id: "rainy", label: "Pluie", Icon: make("rain") },
  { id: "stormy", label: "Orage", Icon: make("storm") },
  { id: "snowy", label: "Neige", Icon: make("snow") },
] as const;

export const MOOD_OPTIONS = [
  { id: "very-happy", label: "Très content", Icon: make("face-very-happy") },
  { id: "happy", label: "Content", Icon: make("face-happy") },
  { id: "neutral", label: "Bof", Icon: make("face-neutral") },
  { id: "sad", label: "Triste", Icon: make("face-sad") },
  { id: "angry", label: "Fâché", Icon: make("face-angry") },
] as const;

export const ACTIVITY_OPTIONS = [
  { id: "painting", label: "Peinture", Icon: make("brush") },
  { id: "reading", label: "Lecture", Icon: make("book") },
  { id: "sport", label: "Sport", Icon: make("ball") },
  { id: "music", label: "Musique", Icon: make("music") },
  { id: "puzzle", label: "Puzzle", Icon: make("puzzle") },
  { id: "park", label: "Parc", Icon: make("tree") },
  { id: "cooking", label: "Cuisine", Icon: make("pan") },
  { id: "swimming", label: "Piscine", Icon: make("wave") },
  { id: "friends", label: "Copains", Icon: make("people") },
  { id: "crafts", label: "Bricolage", Icon: make("scissors") },
  { id: "animals", label: "Animaux", Icon: make("paw") },
  { id: "dressup", label: "Déguisement", Icon: make("mask") },
] as const;
