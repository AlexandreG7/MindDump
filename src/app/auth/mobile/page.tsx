import type { Metadata } from "next";
import { Suspense } from "react";
import { MobileSignIn } from "./MobileSignIn";

// Étape du navigateur système dans la connexion depuis l'app (src/lib/mobileAuth.ts).
export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function MobileSignInPage() {
  return (
    <Suspense>
      <MobileSignIn />
    </Suspense>
  );
}
