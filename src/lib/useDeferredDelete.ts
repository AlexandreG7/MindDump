"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notifyRemindersChanged } from "@/lib/localReminders";
import { TOAST_ACTION_DURATION, useFeedback } from "@/components/ui/feedback";

interface PendingDelete {
  timer: ReturnType<typeof setTimeout>;
  toastId: number;
  url: string;
}

interface RequestDeleteParams {
  /** Identifiant de l'élément, utilisé pour le masquer et dédupliquer. */
  id: string;
  /** URL de l'API DELETE pour cet élément. */
  url: string;
  /** Texte du toast affiché immédiatement (avec le bouton « Annuler »). */
  confirmMessage: string;
  /** Texte du toast d'erreur si le DELETE différé échoue. */
  errorMessage: string;
  /** Rafraîchissement appelé une fois le DELETE résolu (succès ou échec). */
  refresh: () => void;
}

/**
 * Suppression différée avec annulation (toast « Annuler »), partagée entre
 * tâches et listes : l'élément disparaît tout de suite, la requête DELETE ne
 * part qu'à la fin du délai, sauf annulation.
 *
 * - Double appel pour le même id avant le re-rendu : le second est ignoré.
 *   Sans cette garde, la seconde entrée écraserait la première dans la map
 *   sans `clearTimeout`, et le premier minuteur, orphelin, enverrait un
 *   second DELETE qui renvoie un 404 et déclenche un faux toast d'erreur.
 * - Échec du DELETE différé : toast d'erreur, l'élément réapparaît (retiré
 *   de `hidden`), puis rafraîchissement.
 * - Fermeture d'onglet ou rechargement dur pendant le délai : le nettoyage
 *   React ci-dessous ne s'exécute jamais dans ce cas, donc la suppression ne
 *   partirait jamais. `pagehide` l'envoie à la place, avec
 *   `fetch(..., { keepalive: true })` (`sendBeacon` ne fait que du POST, donc
 *   ne convient pas), puis vide la map pour qu'elle ne soit pas renvoyée en
 *   double par le nettoyage.
 */
export function useDeferredDelete() {
  const { toast, dismiss } = useFeedback();
  const pendingDeletes = useRef(new Map<string, PendingDelete>());
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const unhide = useCallback((id: string) => {
    setHidden((h) => {
      if (!h.has(id)) return h;
      const next = new Set(h);
      next.delete(id);
      return next;
    });
  }, []);

  const sendDelete = useCallback((id: string, url: string) => {
    pendingDeletes.current.delete(id);
    return fetch(url, { method: "DELETE", keepalive: true }).catch(() => null);
  }, []);

  const requestDelete = useCallback(
    ({ id, url, confirmMessage, errorMessage, refresh }: RequestDeleteParams) => {
      // Une suppression est déjà en attente pour cet id : on ignore le
      // second appel (voir la note ci-dessus sur le double clic).
      if (pendingDeletes.current.has(id)) return;

      setHidden((h) => new Set(h).add(id));
      const timer = setTimeout(async () => {
        const res = await sendDelete(id, url);
        notifyRemindersChanged();
        if (!res?.ok) {
          toast(errorMessage, "error");
          unhide(id);
        }
        refresh();
      }, TOAST_ACTION_DURATION);

      const toastId = toast(confirmMessage, "info", {
        label: "Annuler",
        onClick: () => {
          clearTimeout(pendingDeletes.current.get(id)?.timer);
          pendingDeletes.current.delete(id);
          unhide(id);
        },
      });

      pendingDeletes.current.set(id, { timer, toastId, url });
    },
    [sendDelete, toast, unhide]
  );

  // Fermeture d'onglet ou rechargement dur : on envoie les suppressions en
  // attente depuis `pagehide`, puis on vide la map pour que le nettoyage
  // React (effet suivant) ne les envoie pas une seconde fois.
  useEffect(() => {
    const pending = pendingDeletes.current;
    const flushOnHide = () => {
      if (pending.size === 0) return;
      pending.forEach(({ url }) => {
        fetch(url, { method: "DELETE", keepalive: true }).catch(() => {});
      });
      pending.clear();
    };
    window.addEventListener("pagehide", flushOnHide);
    return () => window.removeEventListener("pagehide", flushOnHide);
  }, []);

  // En quittant la page (navigation interne, sans pagehide), les
  // suppressions encore en attente partent tout de suite.
  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      pending.forEach(({ timer, toastId, url }, id) => {
        clearTimeout(timer);
        dismiss(toastId);
        // Reprogramme les rappels une fois la suppression traitée (démontage
        // d'une route dans l'app ; sur `pagehide` la page part, sans objet).
        sendDelete(id, url).then(notifyRemindersChanged);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { hidden, requestDelete };
}
