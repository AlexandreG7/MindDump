import type { Metadata } from "next";
import "./register.css";

// Page de la bêta privée : pas d'indexation (robots.ts la disallow aussi).
export const metadata: Metadata = {
  title: "Demander un accès à la bêta",
  description:
    "MindDump est en bêta privée. Demande ton accès pour partager tâches, courses, menus et agenda avec ton foyer.",
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
