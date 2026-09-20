import type { Metadata } from "next";

// Page publique mais sans intérêt pour la recherche : robots.txt bloque le
// crawl, noindex évite l'indexation d'une URL découverte par un lien externe.
export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
