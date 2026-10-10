"use client";

import { SessionProvider } from "next-auth/react";
import { GroupProvider } from "./GroupContext";
import { FeaturesProvider } from "./FeaturesContext";
import { ThemeProvider } from "./ThemeContext";
import { FeedbackProvider } from "./ui/feedback";
import { AppHealth } from "./AppHealth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AppHealth />
        <GroupProvider>
          <FeaturesProvider>
            <FeedbackProvider>{children}</FeedbackProvider>
          </FeaturesProvider>
        </GroupProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
