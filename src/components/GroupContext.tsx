"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true" && process.env.NODE_ENV !== "production";

export interface GroupInfo {
  id: string;
  name: string;
  isDefault: boolean;
  ownerId: string;
  _count?: { members: number };
}

interface GroupContextValue {
  groups: GroupInfo[];
  currentGroupId: string | null;
  currentGroup: GroupInfo | null;
  setCurrentGroupId: (id: string | null) => void;
  loading: boolean;
  /** Le groupe courant est connu : les pages peuvent charger leurs données. */
  ready: boolean;
  refresh: () => void;
}

const GroupContext = createContext<GroupContextValue>({
  groups: [],
  currentGroupId: null,
  currentGroup: null,
  setCurrentGroupId: () => {},
  loading: false,
  ready: false,
  refresh: () => {},
});

// `currentGroupId` servait de clé brute, partagée par appareil, avant
// l'association par utilisateur : un autre compte sur le même appareil
// reprenait alors le groupe du précédent. Elle sert maintenant de préfixe
// pour une clé par utilisateur ; l'ancienne valeur brute, si elle traîne
// encore, est reprise une seule fois par le premier compte qui la lit, puis
// supprimée (voir savedGroupId).
const STORAGE_KEY = "currentGroupId";

function storageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`;
}

function savedGroupId(userId: string): string | null {
  try {
    const own = localStorage.getItem(storageKey(userId));
    if (own) return own;
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      // Si ce groupe n'appartient pas à cet utilisateur, fetchGroups() le
      // détecte juste après (absent de ses groupes) et revient au groupe par
      // défaut : la migration n'a rien d'irréversible.
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(storageKey(userId), legacy);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function GroupProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [currentGroupId, setCurrentGroupIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const firstLoad = useRef(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);
  // Sentinelle distincte de `null` : force la (ré)initialisation même quand le
  // premier id d'utilisateur résolu est `null` (session pas encore chargée).
  const lastUserId = useRef<string | null | undefined>(undefined);

  const userId = skipAuth
    ? "dev-user"
    : status === "authenticated"
      ? session?.user?.id ?? null
      : null;

  // Le groupe choisi la dernière fois est repris tout de suite, sans attendre
  // /api/groups : les pages chargent leurs données une seule fois, avec le bon
  // groupe, au lieu d'un premier chargement sans groupe suivi d'un second.
  // Rejoué à chaque changement d'utilisateur (déconnexion/reconnexion dans le
  // même onglet, ou autre compte sur le même appareil) : on ne garde jamais la
  // validation faite pour le compte précédent.
  useEffect(() => {
    if (userId === lastUserId.current) return;
    lastUserId.current = userId;
    firstLoad.current = true;
    setGroups([]);
    setReady(false);

    if (!userId) {
      setCurrentGroupIdState(null);
      return;
    }
    const saved = savedGroupId(userId);
    if (saved) {
      setCurrentGroupIdState(saved);
      setReady(true);
    } else {
      setCurrentGroupIdState(null);
    }
  }, [userId]);

  const fetchGroups = useCallback(async () => {
    const isAuthed = skipAuth || status === "authenticated";
    if (!isAuthed || !userId) return;

    setLoading(true);
    let failed = false;
    try {
      // Délai maximal : sur une connexion morte (retour d'arrière-plan, changement
      // de réseau), la requête resterait en attente et `ready` ne passerait
      // jamais à vrai, d'où des pages vides jusqu'à la relance de l'app.
      const res = await fetchWithTimeout("/api/groups", {}, 8000);
      if (!res.ok) return;
      const data = await res.json();

      const allGroups: GroupInfo[] = [
        ...(data.owned || []),
        ...(data.member || []),
      ];
      setGroups(allGroups);

      if (firstLoad.current) {
        firstLoad.current = false;
        // Groupe enregistré quitté ou supprimé : on prend le groupe par défaut.
        const saved = savedGroupId(userId);
        if (!saved || !allGroups.some((g) => g.id === saved)) {
          const defaultGroup = allGroups.find((g) => g.isDefault);
          setCurrentGroupIdState(defaultGroup?.id ?? null);
          try {
            if (defaultGroup) localStorage.setItem(storageKey(userId), defaultGroup.id);
            else localStorage.removeItem(storageKey(userId));
          } catch {}
        }
      }
      attempts.current = 0;
    } catch {
      // Réseau indisponible ou trop lent : on garde le groupe enregistré, et on
      // réessaie (le groupe par défaut n'est connu qu'après une réponse).
      failed = true;
    } finally {
      setLoading(false);
      setReady(true);
    }
    if (failed && attempts.current < 3) {
      attempts.current += 1;
      retryTimer.current = setTimeout(() => fetchGroups(), 3000 * attempts.current);
    }
  }, [status, userId]);

  // Le réseau revient : on relit les groupes sans attendre le prochain essai.
  useEffect(() => {
    const onOnline = () => {
      attempts.current = 0;
      fetchGroups();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [fetchGroups]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const setCurrentGroupId = (id: string | null) => {
    setCurrentGroupIdState(id);
    if (typeof window !== "undefined" && userId) {
      if (id) localStorage.setItem(storageKey(userId), id);
      else localStorage.removeItem(storageKey(userId));
    }
  };

  const currentGroup = groups.find((g) => g.id === currentGroupId) ?? null;

  return (
    <GroupContext.Provider
      value={{ groups, currentGroupId, currentGroup, setCurrentGroupId, loading, ready, refresh: fetchGroups }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroupContext() {
  return useContext(GroupContext);
}
