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

const STORAGE_KEY = "currentGroupId";

function savedGroupId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function GroupProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [currentGroupId, setCurrentGroupIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const firstLoad = useRef(true);

  // Le groupe choisi la dernière fois est repris tout de suite, sans attendre
  // /api/groups : les pages chargent leurs données une seule fois, avec le bon
  // groupe, au lieu d'un premier chargement sans groupe suivi d'un second.
  useEffect(() => {
    const saved = savedGroupId();
    if (saved) {
      setCurrentGroupIdState(saved);
      setReady(true);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    const isAuthed = skipAuth || status === "authenticated";
    if (!isAuthed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/groups");
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
        const saved = savedGroupId();
        if (!saved || !allGroups.some((g) => g.id === saved)) {
          const defaultGroup = allGroups.find((g) => g.isDefault);
          setCurrentGroupIdState(defaultGroup?.id ?? null);
          try {
            if (defaultGroup) localStorage.setItem(STORAGE_KEY, defaultGroup.id);
            else localStorage.removeItem(STORAGE_KEY);
          } catch {}
        }
      }
    } catch {
      // Réseau indisponible : on garde le groupe enregistré.
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [status]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const setCurrentGroupId = (id: string | null) => {
    setCurrentGroupIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
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
