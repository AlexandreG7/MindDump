"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { THEME_COLORS, THEME_STORAGE_KEY as STORAGE_KEY, type ThemePreference } from "@/lib/theme";
import { setNativeSystemBars } from "@/lib/native";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  /** Thème imposé le temps d'une session (mode cuisine) : jamais enregistré, `null` rend la préférence. */
  setSessionTheme: (theme: "light" | "dark" | null) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  setSessionTheme: () => {},
});

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Les balises theme-color (layout.tsx) suivent le thème du système ; quand
// l'utilisateur en force un, la barre d'état doit suivre le thème affiché.
function applyThemeColor(dark: boolean) {
  const color = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [sessionTheme, setSessionTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") setThemeState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const effective = sessionTheme ?? theme;
      const dark = effective === "dark" || (effective === "system" && systemPrefersDark());
      document.documentElement.classList.toggle("dark", dark);
      applyThemeColor(dark);
      setNativeSystemBars(dark);
      setResolvedTheme(dark ? "dark" : "light");
    };
    apply();
    if ((sessionTheme ?? theme) !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, sessionTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, setSessionTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
