import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — assistant IA, calendrier et liens publics",
  description:
    "Connecter MindDump à un assistant IA, s'abonner au calendrier familial et partager ses recettes : la documentation des intégrations.",
  alternates: { canonical: "/docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
