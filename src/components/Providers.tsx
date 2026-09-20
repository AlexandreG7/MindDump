"use client";

import { SessionProvider } from "next-auth/react";
import { GroupProvider } from "./GroupContext";
import { FeaturesProvider } from "./FeaturesContext";
import { ThemeProvider } from "./ThemeContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <GroupProvider>
          <FeaturesProvider>{children}</FeaturesProvider>
        </GroupProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
