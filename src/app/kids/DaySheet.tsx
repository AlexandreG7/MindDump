"use client";

import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KidDayValues, KidTrackerDto } from "@/lib/kidWeek";
import { DayForm } from "./DayForm";
import { KidsSheet } from "./KidsSheet";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Saisie d'un jour (parent) : flèches pour passer au jour voisin de la semaine, chaque choix est enregistré aussitôt. */
export function DaySheet({
  date,
  focusTrackerId,
  weekFrom,
  weekTo,
  trackers,
  values,
  onChange,
  onDateChange,
  onClose,
}: {
  date: string | null;
  focusTrackerId: string | null;
  weekFrom: string;
  weekTo: string;
  trackers: KidTrackerDto[];
  values: Record<string, KidDayValues>;
  onChange: (date: string, trackerId: string, next: string[] | number | null) => void;
  onDateChange: (date: string) => void;
  onClose: () => void;
}) {
  const day = date ? parseISO(date) : null;
  const prev = day ? iso(addDays(day, -1)) : null;
  const next = day ? iso(addDays(day, 1)) : null;
  const nav = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30";
  return (
    <KidsSheet
      open={!!date}
      onOpenChange={(o) => !o && onClose()}
      title={day ? format(day, "EEEE d MMMM", { locale: fr }) : ""}
      description="Saisie des rubriques de ce jour. Chaque choix est enregistré tout de suite."
      headerLeading={
        <button type="button" className={nav} disabled={!prev || prev < weekFrom} onClick={() => prev && onDateChange(prev)} aria-label="Jour précédent">
          <ChevronLeft className="h-5 w-5" />
        </button>
      }
      headerTrailing={
        <button type="button" className={nav} disabled={!next || next > weekTo} onClick={() => next && onDateChange(next)} aria-label="Jour suivant">
          <ChevronRight className="h-5 w-5" />
        </button>
      }
      footer={
        <Button className="h-12 w-full rounded-full text-base" onClick={onClose}>
          Terminé
        </Button>
      }
    >
      {date && (
        <DayForm
          key={date}
          trackers={trackers}
          values={values[date] ?? {}}
          focusTrackerId={focusTrackerId}
          onChange={(trackerId, v) => onChange(date, trackerId, v)}
        />
      )}
    </KidsSheet>
  );
}
