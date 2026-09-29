import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAuthBypassEnabled } from "@/lib/devAuth";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/landing/Landing";
import { NATIVE_APP_COOKIE, isNativeRequest } from "@/lib/native";

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
