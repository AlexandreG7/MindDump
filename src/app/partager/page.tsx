import type { Metadata } from "next";
import { Suspense } from "react";
import { ShareReceiver } from "./ShareReceiver";

// Cible du menu Partager (share_target dans src/app/manifest.ts).
export const metadata: Metadata = {
  title: "Partager",
  robots: { index: false, follow: false },
};

export default function SharePage() {
  return (
    <Suspense>
      <ShareReceiver />
    </Suspense>
  );
}
