import Link from "next/link";
import { INVITE_INVALID_MESSAGE, findValidInvite } from "@/lib/signupInvite";
import { RegisterForm } from "./RegisterForm";
import { RequestAccessForm } from "./RequestAccessForm";

// Le jeton d'invitation est vérifié à chaque affichage : pas de rendu figé au build.
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">MindDump</h1>
          <p className="text-muted-foreground text-sm">Vide ta charge mentale</p>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { invite?: string | string[] };
}) {
  const token = Array.isArray(searchParams.invite) ? searchParams.invite[0] : searchParams.invite;

  // Sans jeton : demande d'accès à la bêta (bêta privée).
  if (token === undefined) return <RequestAccessForm />;

  // Avec jeton : inscription, e-mail verrouillé sur l'adresse invitée.
  const invite = await findValidInvite(token);
  if (invite) return <RegisterForm inviteToken={token} inviteEmail={invite.email} />;

  return (
    <Shell>
      <h2 className="text-xl font-semibold">Lien d&apos;invitation invalide</h2>
      <p className="text-sm text-muted-foreground">{INVITE_INVALID_MESSAGE}</p>
      <p className="text-sm">
        <Link href="/register" className="text-primary font-medium hover:underline">
          Demander un accès à la bêta
        </Link>
      </p>
      <p className="text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Se connecter
        </Link>
      </p>
    </Shell>
  );
}
