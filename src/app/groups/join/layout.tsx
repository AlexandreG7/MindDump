import type { Metadata } from "next";

// Les invitations portent un jeton dans l'URL : jamais d'indexation.
export const metadata: Metadata = {
  title: "Rejoindre un groupe",
  robots: { index: false, follow: false },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
