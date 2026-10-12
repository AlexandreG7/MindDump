/**
 * Teintes par module de l'app v2 : tâches (orange), courses (herbe), repas
 * (safran), agenda (ciel). Un aplat franc par module ; le texte posé dessus est
 * toujours l'encre (`text-on-tone`). Classes écrites en toutes lettres pour que
 * Tailwind les repère. Voir docs/app-redesign/01-direction.md.
 */
export type Tone = "todo" | "list" | "meal" | "agenda";

export const TONE_CLASSES: Record<
  Tone,
  { block: string; soft: string; ink: string; solid: string; border: string; ring: string; stroke: string; fill: string; solidChecked: string }
> = {
  todo: {
    block: "bg-tone-todo text-on-tone",
    soft: "bg-tone-todo-soft",
    ink: "text-tone-todo-ink",
    solid: "bg-tone-todo",
    border: "border-tone-todo",
    ring: "ring-tone-todo",
    stroke: "stroke-tone-todo",
    fill: "fill-tone-todo",
    solidChecked: "group-data-[state=checked]/check:bg-tone-todo",
  },
  list: {
    block: "bg-tone-list text-on-tone",
    soft: "bg-tone-list-soft",
    ink: "text-tone-list-ink",
    solid: "bg-tone-list",
    border: "border-tone-list",
    ring: "ring-tone-list",
    stroke: "stroke-tone-list",
    fill: "fill-tone-list",
    solidChecked: "group-data-[state=checked]/check:bg-tone-list",
  },
  meal: {
    block: "bg-tone-meal text-on-tone",
    soft: "bg-tone-meal-soft",
    ink: "text-tone-meal-ink",
    solid: "bg-tone-meal",
    border: "border-tone-meal",
    ring: "ring-tone-meal",
    stroke: "stroke-tone-meal",
    fill: "fill-tone-meal",
    solidChecked: "group-data-[state=checked]/check:bg-tone-meal",
  },
  agenda: {
    block: "bg-tone-agenda text-on-tone",
    soft: "bg-tone-agenda-soft",
    ink: "text-tone-agenda-ink",
    solid: "bg-tone-agenda",
    border: "border-tone-agenda",
    ring: "ring-tone-agenda",
    stroke: "stroke-tone-agenda",
    fill: "fill-tone-agenda",
    solidChecked: "group-data-[state=checked]/check:bg-tone-agenda",
  },
};
