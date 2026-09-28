import type { Metadata } from "next";
import { WallScreen } from "./WallScreen";

// Lien secret d'un écran mural : jamais indexé, jamais mis en cache côté serveur.
export const metadata: Metadata = {
  title: "Écran du foyer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function WallPage({ params }: { params: { token: string } }) {
  return <WallScreen token={params.token} />;
}
