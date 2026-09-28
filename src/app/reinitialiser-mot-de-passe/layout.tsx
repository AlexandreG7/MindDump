import type { Metadata } from "next";

// Le lien porte un jeton : jamais d'indexation.
export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
