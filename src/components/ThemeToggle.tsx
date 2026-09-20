"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";
import { useTheme } from "./ThemeContext";

const OPTIONS: Record<ThemePreference, { label: string; icon: typeof Sun; next: ThemePreference }> = {
  system: { label: "Système", icon: Monitor, next: "light" },
  light: { label: "Clair", icon: Sun, next: "dark" },
  dark: { label: "Sombre", icon: Moon, next: "system" },
};

export function ThemeToggle({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  const { theme, setTheme } = useTheme();
  const current = OPTIONS[theme];
  const Icon = current.icon;

  return (
    <button
      type="button"
      onClick={() => setTheme(current.next)}
      title={`Thème : ${current.label} (passer en ${OPTIONS[current.next].label.toLowerCase()})`}
      aria-label={`Thème : ${current.label}`}
      className={cn(
        "rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
        className
      )}
    >
      <Icon className={cn("h-4 w-4", iconClassName)} />
    </button>
  );
}
