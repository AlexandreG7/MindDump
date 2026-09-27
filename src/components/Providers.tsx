"use client";

import { SessionProvider } from "next-auth/react";
import { GroupProvider } from "./GroupContext";
import { FeaturesProvider } from "./FeaturesContext";
import { ThemeProvider } from "./ThemeContext";
import { FeedbackProvider } from "./ui/feedback";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <GroupProvider>
          <FeaturesProvider>
            <FeedbackProvider>{children}</FeedbackProvider>
          </FeaturesProvider>
        </GroupProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
