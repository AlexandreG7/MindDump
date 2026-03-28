"use client";

import { SessionProvider } from "next-auth/react";
import { GroupProvider } from "./GroupContext";
import { FeaturesProvider } from "./FeaturesContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GroupProvider>
        <FeaturesProvider>{children}</FeaturesProvider>
      </GroupProvider>
    </SessionProvider>
  );
}
