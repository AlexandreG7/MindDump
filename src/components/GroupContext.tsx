"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

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
  refresh: () => void;
}

const GroupContext = createContext<GroupContextValue>({
  groups: [],
  currentGroupId: null,
  currentGroup: null,
  setCurrentGroupId: () => {},
  loading: false,
  refresh: () => {},
});

export function GroupProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [currentGroupId, setCurrentGroupIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

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

      if (!ready) {
        // Première charge : restaurer depuis localStorage ou prendre le groupe par défaut
        const saved =
          typeof window !== "undefined"
            ? localStorage.getItem("currentGroupId")
            : null;

        const validSaved = saved && allGroups.find((g) => g.id === saved);
        if (validSaved) {
          setCurrentGroupIdState(saved);
        } else {
          const defaultGroup = allGroups.find((g) => g.isDefault);
          if (defaultGroup) {
            setCurrentGroupIdState(defaultGroup.id);
            localStorage.setItem("currentGroupId", defaultGroup.id);
          }
        }
        setReady(true);
      }
    } finally {
      setLoading(false);
    }
  }, [status, ready]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const setCurrentGroupId = (id: string | null) => {
    setCurrentGroupIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("currentGroupId", id);
      else localStorage.removeItem("currentGroupId");
    }
  };

  const currentGroup = groups.find((g) => g.id === currentGroupId) ?? null;

  return (
    <GroupContext.Provider
      value={{ groups, currentGroupId, currentGroup, setCurrentGroupId, loading, refresh: fetchGroups }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroupContext() {
  return useContext(GroupContext);
}
