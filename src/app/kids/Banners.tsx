"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Rubriques reprises de l'ancien semainier : visible tant qu'une rubrique affichée n'a pas été renommée. */
export function RenameBanner({ names, onRename }: { names: string[]; onRename: () => void }) {
  const list = names.map((n) => `« ${n} »`).join(names.length > 2 ? ", " : " et ");
  return (
    <div role="status" className="flex flex-col gap-3 rounded-[1.25rem] bg-tone-todo-soft p-4 text-tone-todo-ink sm:flex-row sm:items-center">
      <Sparkles className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden />
      <p className="min-w-0 flex-1 text-base font-bold leading-snug">
        {names.length === 1 ? "Une rubrique reprise" : names.length === 2 ? "Deux rubriques reprises" : `${names.length} rubriques reprises`} de
        l&apos;ancien semainier : {list}. Donne-{names.length > 1 ? "leur" : "lui"} le nom que tu veux.
      </p>
      <Button onClick={onRename} className="h-11 shrink-0 rounded-full px-5 text-base">
        Renommer
      </Button>
    </div>
  );
}

/** Le serveur a refusé une écriture d'une ancienne version de l'interface (409 outdated_client). */
export function OutdatedBanner({ className }: { className?: string }) {
  return (
    <div role="alert" className={className}>
      <div className="flex flex-col gap-3 rounded-[1.25rem] bg-ink p-4 text-ink-foreground sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-base font-bold leading-snug">
          Une nouvelle version du Semainier est disponible. Recharge la page pour continuer à remplir la semaine.
        </p>
        <Button
          variant="secondary"
          onClick={() => window.location.reload()}
          className="h-11 shrink-0 rounded-full px-5 text-base"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Recharger
        </Button>
      </div>
    </div>
  );
}
