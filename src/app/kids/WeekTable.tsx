"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type { KidDayValues, KidTrackerDto } from "@/lib/kidWeek";
import { TrackerIcon } from "./DayForm";

export interface WeekDay {
  date: string; // AAAA-MM-JJ
  day: Date;
  today: boolean;
}

/** Ce que dit une case, pour l'œil (images) comme pour le lecteur d'écran (texte). */
function describe(tracker: KidTrackerDto, value: KidDayValues[string] | undefined) {
  if (value === undefined) return { text: "non renseigné", icons: [] as string[], number: null as number | null, extra: 0 };
  if (typeof value === "number") return { text: String(value), icons: [], number: value, extra: 0 };
  const picked = value.map((id) => tracker.options.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
  if (picked.length === 0) return { text: "non renseigné", icons: [], number: null, extra: 0 };
  return {
    text: picked.map((o) => o.label).join(", "),
    icons: [picked[0].icon],
    number: null,
    extra: picked.length - 1,
  };
}

/**
 * Tableau rubriques × jours. Jusqu'à lg (tablette en portrait comprise) le libellé de la rubrique est au-dessus de
 * sa rangée de 7 cases (aucun défilement horizontal à 375 px) ; à partir de lg il
 * passe dans une colonne à gauche. Chaque case est un bouton qui ouvre la saisie du
 * jour sur cette rubrique. Aujourd'hui : pastille pleine « auj. » en tête et contour.
 */
export function WeekTable({
  trackers,
  days,
  values,
  onOpen,
}: {
  trackers: KidTrackerDto[];
  days: WeekDay[];
  values: Record<string, KidDayValues>;
  onOpen: (date: string, trackerId?: string) => void;
}) {
  const cols = "lg:grid lg:grid-cols-[13rem_repeat(7,minmax(0,1fr))] lg:items-center lg:gap-x-1.5";
  return (
    <Surface className="p-2.5 sm:p-3 lg:p-5" role="group" aria-label="Semaine, rubrique par rubrique">
      <div className={cn("grid grid-cols-7 gap-0.5 sm:gap-1", cols)}>
        <span className="hidden lg:block" aria-hidden />
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => onOpen(d.date)}
            aria-label={`Saisir ${format(d.day, "EEEE d MMMM", { locale: fr })}${d.today ? ", aujourd'hui" : ""}`}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-xl px-0.5 py-1 leading-none transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              d.today ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            <span className="text-[0.8125rem] font-bold">{d.today ? "auj." : format(d.day, "EEE", { locale: fr }).replace(".", "")}</span>
            <span className={cn("mt-1 text-base font-extrabold tabular-nums", d.today ? "text-ink-foreground" : "text-foreground")}>
              {format(d.day, "d")}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 divide-y divide-border/70">
        {trackers.map((t) => (
          <div key={t.id} role="group" aria-label={t.label} className={cn("py-2.5", cols, "lg:gap-y-0")}>
            <div className="mb-1.5 flex min-w-0 items-center gap-2 lg:mb-0 lg:pr-2">
              <TrackerIcon id={t.icon} size={24} className="shrink-0" />
              <h3 className="min-w-0 truncate text-base font-extrabold lg:text-[1.0625rem]" title={t.label}>
                {t.label}
              </h3>
            </div>
            <div className="contents">
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 lg:contents">
                {days.map((d) => {
                  const v = describe(t, values[d.date]?.[t.id]);
                  const empty = v.text === "non renseigné";
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => onOpen(d.date, t.id)}
                      aria-label={`${format(d.day, "EEEE d MMMM", { locale: fr })}${d.today ? ", aujourd'hui" : ""}, ${t.label} : ${v.text}`}
                      className={cn(
                        "relative flex h-12 min-w-0 items-center justify-center rounded-xl text-foreground lg:h-14",
                        "transition-[transform,background-color] duration-150 ease-out active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        empty
                          ? "border border-dashed border-muted-foreground/35 bg-transparent text-muted-foreground/60 hover:bg-secondary"
                          : "bg-tone-list-soft hover:brightness-95",
                        d.today && "ring-2 ring-tone-list-ink ring-offset-1 ring-offset-card"
                      )}
                    >
                      {empty ? (
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      ) : v.number !== null ? (
                        <span className="text-xl font-extrabold tabular-nums">{v.number}</span>
                      ) : (
                        <>
                          <TrackerIcon id={v.icons[0]} size={30} />
                          {v.extra > 0 && (
                            <span
                              aria-hidden
                              className="absolute -right-0.5 -top-1 min-w-[1.125rem] rounded-full bg-tone-list-ink px-1 text-center text-[0.6875rem] font-extrabold leading-[1.125rem] text-card tabular-nums"
                            >
                              +{v.extra}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}
