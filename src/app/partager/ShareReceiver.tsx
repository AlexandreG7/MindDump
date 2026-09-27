"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckSquare, ChefHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { useGroupContext } from "@/components/GroupContext";
import {
  RECIPE_SOURCE_NAMES,
  importRoute,
  readShared,
  recipeSource,
  todoTitle,
} from "@/lib/share";

/**
 * Un lien de recette HelloFresh, Jow ou Quitoque est importé tout de suite
 * (même route que l'import manuel et le MCP, enrichissement compris). Tout
 * autre contenu peut devenir une tâche.
 */
export function ShareReceiver() {
  const { isReady } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { currentGroupId } = useGroupContext();

  const shared = readShared(params);
  const source = recipeSource(shared.url);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!isReady || !source || started.current) return;
    started.current = true;
    (async () => {
      const res = await fetch(importRoute(source), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: shared.url, groupId: currentGroupId ?? undefined }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      if (res?.ok && data?.id) {
        router.replace(`/recipes/${data.id}`);
      } else {
        setError(
          res
            ? data?.error ?? "L'import de la recette a échoué."
            : "Pas de connexion : l'import de la recette a besoin du réseau."
        );
      }
    })();
  }, [isReady, source, shared.url, currentGroupId, router]);

  const createTodo = async () => {
    setBusy(true);
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: todoTitle(shared),
        description: shared.url && shared.url !== todoTitle(shared) ? shared.url : null,
        groupId: currentGroupId ?? undefined,
      }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace("/todos");
    } else {
      setBusy(false);
      setError("La tâche n'a pas pu être créée.");
    }
  };

  if (!isReady) return null;

  const importing = source && !error;
  const nothing = !todoTitle(shared);

  return (
    <div className="max-w-md mx-auto pt-8 space-y-6">
      {importing ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Import de la recette {RECIPE_SOURCE_NAMES[source]}…
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Ajouter à MindDump</h1>
            {!nothing && (
              <p className="text-sm text-muted-foreground break-words">{todoTitle(shared)}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {nothing ? (
            <p className="text-sm text-muted-foreground">Rien à ajouter dans ce partage.</p>
          ) : (
            <div className="space-y-2">
              <Button className="w-full justify-start gap-2" onClick={createTodo} disabled={busy}>
                <CheckSquare className="h-4 w-4" />
                Créer une tâche
              </Button>
              {source && (
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <Link href="/recipes">
                    <ChefHat className="h-4 w-4" />
                    Ouvrir les recettes
                  </Link>
                </Button>
              )}
            </div>
          )}

          <Link href="/" className="block text-sm text-muted-foreground hover:underline">
            Annuler
          </Link>
        </>
      )}
    </div>
  );
}
