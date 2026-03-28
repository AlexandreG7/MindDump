"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";

export type FeatureKey = "todos" | "calendar" | "lists" | "recipes";

const DEFAULT_FLAGS: Record<FeatureKey, boolean> = {
  todos: true,
  calendar: true,
  lists: true,
  recipes: true,
};

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

interface FeaturesContextValue {
  flags: Record<FeatureKey, boolean>;
  toggle: (feature: FeatureKey, enabled: boolean) => Promise<void>;
  loading: boolean;
}

const FeaturesContext = createContext<FeaturesContextValue>({
  flags: DEFAULT_FLAGS,
  toggle: async () => {},
  loading: true,
});

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [flags, setFlags] = useState<Record<FeatureKey, boolean>>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async (attempt = 0) => {
    try {
      const res = await fetch("/api/features");
      if (res.ok) {
        const data = await res.json();
        setFlags({ ...DEFAULT_FLAGS, ...data });
        setLoading(false);
      } else if (attempt < 3) {
        // Retry on server error (e.g. Prisma client not ready yet)
        setTimeout(() => fetchFlags(attempt + 1), 600 * (attempt + 1));
      } else {
        // After 3 retries, give up and show defaults
        setLoading(false);
      }
    } catch {
      if (attempt < 3) {
        setTimeout(() => fetchFlags(attempt + 1), 600 * (attempt + 1));
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (skipAuth || status === "authenticated") {
      fetchFlags();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, fetchFlags]);

  const toggle = useCallback(async (feature: FeatureKey, enabled: boolean) => {
    // Optimistic update
    setFlags((prev) => ({ ...prev, [feature]: enabled }));

    const res = await fetch("/api/features", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, enabled }),
    });

    if (!res.ok) {
      // Revert on failure
      setFlags((prev) => ({ ...prev, [feature]: !enabled }));
    }
  }, []);

  return (
    <FeaturesContext.Provider value={{ flags, toggle, loading }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeaturesContext() {
  return useContext(FeaturesContext);
}
