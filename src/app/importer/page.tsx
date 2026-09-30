import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportReceiver } from "./ImportReceiver";

// Import IA ouvert depuis le partage natif (Android : /importer?shared=1) ou
// directement par son adresse.
export const metadata: Metadata = {
  title: "Importer avec l'IA",
  robots: { index: false, follow: false },
};

export default function ImportPage() {
  return (
    <Suspense>
      <ImportReceiver />
    </Suspense>
  );
}
