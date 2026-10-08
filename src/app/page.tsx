import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAuthBypassEnabled } from "@/lib/devAuth";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/landing/Landing";
import { NATIVE_APP_COOKIE, isNativeRequest } from "@/lib/native";
import type { Metadata } from "next";
import { siteDescription, siteName, siteTitle } from "@/lib/site";

// Canonique de la racine : la seule page indexable qui n'a pas son fichier de
// métadonnées dédié. Le layout racine ne déclare volontairement pas de canonical.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName,
    title: siteTitle,
    description: siteDescription,
  },
};

/**
 * Le choix landing / dashboard se fait côté serveur, et pas depuis
 * useSession() : un composant client aurait servi un HTML vide (« Chargement »)
 * aux robots d'indexation, qui arrivent toujours déconnectés. Le rendu dépend
 * du cookie de session, la page est donc dynamique par nature.
 */
export default async function Home() {
  // Jamais actif en production (voir devAuth.ts).
  if (isAuthBypassEnabled) return <Dashboard />;

  const session = await getServerSession(authOptions);
  if (session?.user) return <Dashboard />;

  // Dans l'app native, la page de présentation n'a pas de sens : on a déjà
  // installé MindDump, on veut se connecter.
  if (isNativeRequest(headers().get("user-agent"), cookies().get(NATIVE_APP_COOKIE)?.value)) {
    redirect("/login");
  }

  return <Landing />;
}
