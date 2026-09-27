"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ProfileAvatar, type FamilyProfile } from "./ProfileAvatar";

/**
 * Personnes du foyer de l'utilisateur (tous ses groupes). Avec un groupe
 * courant, seules celles de ce groupe sont assignables.
 */
export function useFamilyProfiles(groupId: string | null) {
  const [all, setAll] = useState<FamilyProfile[]>([]);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAll)
      .catch(() => {});
  }, []);

  const assignable = groupId ? all.filter((p) => p.groupId === groupId) : all;
  const byId = new Map(all.map((p) => [p.id, p]));
  return { all, assignable, byId };
}

/** Choix des personnes concernées : pastilles à cocher. */
export function AssigneePicker({
  profiles,
  value,
  onChange,
}: {
  profiles: FamilyProfile[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (profiles.length === 0) return null;
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {profiles.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => toggle(p.id)}
            className={cn(
              "flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full border text-sm transition-colors",
              on ? "border-transparent text-white font-medium" : "border-border text-muted-foreground hover:bg-secondary"
            )}
            style={on ? { backgroundColor: p.color } : undefined}
          >
            <ProfileAvatar profile={p} size="sm" className={on ? "ring-2 ring-white/70" : undefined} />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

/** Pastilles superposées des personnes assignées. */
export function AssigneeAvatars({
  ids,
  byId,
  className,
}: {
  ids: string[] | undefined;
  byId: Map<string, FamilyProfile>;
  className?: string;
}) {
  const people = (ids ?? []).map((id) => byId.get(id)).filter((p): p is FamilyProfile => !!p);
  if (people.length === 0) return null;
  return (
    <span className={cn("flex -space-x-1.5 shrink-0", className)} title={people.map((p) => p.name).join(", ")}>
      {people.slice(0, 4).map((p) => (
        <ProfileAvatar key={p.id} profile={p} size="sm" className="ring-2 ring-background w-5 h-5 text-[10px]" />
      ))}
      {people.length > 4 && (
        <span className="w-5 h-5 rounded-full bg-secondary text-[10px] flex items-center justify-center ring-2 ring-background">
          +{people.length - 4}
        </span>
      )}
    </span>
  );
}

/**
 * Filtre « qui » : aucune personne choisie = tout le monde. Les éléments sans
 * personne assignée concernent toute la famille et restent toujours affichés.
 */
export function PeopleFilter({
  profiles,
  value,
  onChange,
}: {
  profiles: FamilyProfile[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (profiles.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par personne">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          "px-2.5 py-1 rounded-full border text-xs transition-colors",
          value.length === 0 ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-secondary"
        )}
      >
        Tout le monde
      </button>
      {profiles.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== p.id) : [...value, p.id])}
            className={cn(
              "flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full border text-xs transition-colors",
              on ? "border-transparent text-white font-medium" : "border-border text-muted-foreground hover:bg-secondary"
            )}
            style={on ? { backgroundColor: p.color } : undefined}
          >
            <ProfileAvatar profile={p} size="sm" className="w-5 h-5 text-[10px]" />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

/** L'élément passe-t-il le filtre « qui » ? */
export function matchesPeople(assigneeIds: string[] | undefined, filter: string[]): boolean {
  if (filter.length === 0 || !assigneeIds || assigneeIds.length === 0) return true;
  return assigneeIds.some((id) => filter.includes(id));
}
