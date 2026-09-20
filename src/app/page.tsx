import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAuthBypassEnabled } from "@/lib/devAuth";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/landing/Landing";

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

  return <Landing />;
}
