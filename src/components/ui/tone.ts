/**
 * Teintes par module de l'app (tâches, courses, repas, agenda).
 * Classes écrites en toutes lettres pour que Tailwind les repère.
 * Voir docs/app-redesign/01-direction.md.
 */
export type Tone = "todo" | "list" | "meal" | "agenda";

export const TONE_CLASSES: Record<
  Tone,
  { soft: string; ink: string; solid: string; border: string; text: string; ring: string; checked: string }
> = {
  todo: {
    soft: "bg-tone-todo-soft",
    ink: "text-tone-todo-ink",
    solid: "bg-tone-todo",
    border: "border-tone-todo",
    text: "text-tone-todo-ink",
    ring: "stroke-tone-todo",
    checked: "group-data-[state=checked]/check:bg-tone-todo group-data-[state=checked]/check:border-tone-todo group-data-[state=checked]/check:text-primary-foreground",
  },
  list: {
    soft: "bg-tone-list-soft",
    ink: "text-tone-list-ink",
    solid: "bg-tone-list",
    border: "border-tone-list",
    text: "text-tone-list-ink",
    ring: "stroke-tone-list",
    checked: "group-data-[state=checked]/check:bg-tone-list group-data-[state=checked]/check:border-tone-list group-data-[state=checked]/check:text-white",
  },
  meal: {
    soft: "bg-tone-meal-soft",
    ink: "text-tone-meal-ink",
    solid: "bg-tone-meal",
    border: "border-tone-meal",
    text: "text-tone-meal-ink",
    ring: "stroke-tone-meal",
    checked: "group-data-[state=checked]/check:bg-tone-meal group-data-[state=checked]/check:border-tone-meal group-data-[state=checked]/check:text-primary-foreground",
  },
  agenda: {
    soft: "bg-tone-agenda-soft",
    ink: "text-tone-agenda-ink",
    solid: "bg-tone-agenda",
    border: "border-tone-agenda",
    text: "text-tone-agenda-ink",
    ring: "stroke-tone-agenda",
    checked: "group-data-[state=checked]/check:bg-tone-agenda group-data-[state=checked]/check:border-tone-agenda group-data-[state=checked]/check:text-white",
  },
};
