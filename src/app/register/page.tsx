import Link from "next/link";
import { INVITE_INVALID_MESSAGE, findValidInvite } from "@/lib/signupInvite";
import { GROUP_INVITE_INVALID_MESSAGE, findSignupGroupInvite, isGroupInviteToken } from "@/lib/groupInviteSignup";
import { Link as LinkIcon } from "lucide-react";
import { BetaShell } from "./BetaShell";
import { RegisterForm } from "./RegisterForm";
import { RequestAccessForm } from "./RequestAccessForm";

// Le jeton d'invitation est vérifié à chaque affichage : pas de rendu figé au build.
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { invite?: string | string[]; groupInvite?: string | string[]; direct?: string | string[] };
}) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const token = first(searchParams.invite);
  const groupToken = first(searchParams.groupInvite);

  // Lien d'invitation de foyer (/groups/join/…) : il ouvre aussi l'inscription, puis ramène au groupe.
  if (token === undefined && groupToken !== undefined) {
    const group = await findSignupGroupInvite(groupToken);
    if (group && isGroupInviteToken(groupToken)) {
      return <RegisterForm groupInviteToken={groupToken} groupName={group.groupName} inviteEmail={group.email} />;
    }
    return <InvalidLink message={GROUP_INVITE_INVALID_MESSAGE} />;
  }

  // Sans jeton : inscription directe pour une adresse autorisée par l'administrateur
  // (?direct=1, sans rien révéler sur la liste : le serveur tranche à l'envoi), sinon demande d'accès.
  if (token === undefined) {
    if (first(searchParams.direct) === "1") return <RegisterForm inviteEmail={null} direct />;
    return <RequestAccessForm />;
  }

  // Avec jeton : inscription, e-mail verrouillé sur l'adresse invitée.
  const invite = await findValidInvite(token);
  if (invite) return <RegisterForm inviteToken={token} inviteEmail={invite.email} />;

  return <InvalidLink message={INVITE_INVALID_MESSAGE} />;
}

function InvalidLink({ message }: { message: string }) {
  return (
    <BetaShell className="max-w-lg">
      <div
        className="beta-rise rounded-3xl border border-border bg-card p-6 text-center shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_-12px_hsl(var(--foreground)/0.18)] sm:p-9"
        role="alert"
      >
        <span className="beta-pop mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <LinkIcon className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Ce lien ne fonctionne plus</h1>
        <p className="mx-auto mt-2 max-w-xs text-pretty text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/register"
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Demander un nouvel accès
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Déjà un compte ? Se connecter
          </Link>
        </div>
      </div>
    </BetaShell>
  );
}
