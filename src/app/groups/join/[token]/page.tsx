"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, XCircle, Loader, LogIn, UserPlus } from "lucide-react";

export default function JoinGroupPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { status } = useSession();
  const [info, setInfo] = useState<{
    groupName: string;
    ownerName: string;
    memberCount: number;
    signupAllowed?: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/join/${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInfo(data);
      });
  }, [params.token]);

  // Sans session : se connecter, ou créer un compte si ce lien l'autorise (une inscription par
  // lien, src/lib/groupInviteSignup.ts). Dans les deux cas, retour sur cette page pour rejoindre.
  const here = `/groups/join/${params.token}`;

  const handleJoin = async () => {
    setJoining(true);
    const res = await fetch(`/api/groups/join/${params.token}`, { method: "POST" });
    const data = await res.json();
    setJoining(false);

    if (!res.ok) {
      setError(data.error || "Erreur lors de la jonction");
    } else {
      setJoined(true);
      setTimeout(() => router.push("/groups"), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Users className="h-8 w-8 text-primary" />
        </div>

        {joined ? (
          <div className="space-y-3">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Tu as rejoint le groupe !</h2>
            <p className="text-sm text-muted-foreground">Redirection en cours…</p>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Invitation invalide</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => router.push("/groups")}>Retour aux groupes</Button>
          </div>
        ) : info ? (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div>
              <p className="text-sm text-muted-foreground">Tu es invité(e) à rejoindre</p>
              <h2 className="text-2xl font-bold mt-1">{info.groupName}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Créé par <span className="font-medium text-foreground">{info.ownerName}</span>
                {" · "}{info.memberCount} membre{info.memberCount > 1 ? "s" : ""}
              </p>
            </div>
            {status === "unauthenticated" ? (
              <div className="space-y-2">
                <Button asChild className="w-full" size="lg">
                  <Link href={`/login?callbackUrl=${encodeURIComponent(here)}`}>
                    <span className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />Se connecter
                    </span>
                  </Link>
                </Button>
                {info.signupAllowed ? (
                  <Button asChild variant="outline" className="w-full" size="lg">
                    <Link href={`/register?groupInvite=${encodeURIComponent(params.token)}`}>
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />Créer mon compte
                      </span>
                    </Link>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ce lien a déjà servi à une inscription. Connecte-toi avec ton compte pour rejoindre le groupe.
                  </p>
                )}
              </div>
            ) : (
              <>
                <Button className="w-full" size="lg" onClick={handleJoin} disabled={joining || status === "loading"}>
                  {joining ? (
                    <span className="flex items-center gap-2">
                      <Loader className="h-4 w-4 animate-spin" />Rejoindre…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />Rejoindre le groupe
                    </span>
                  )}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => router.push("/")}>
                  Annuler
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader className="h-5 w-5 animate-spin" />
            <span>Chargement…</span>
          </div>
        )}
      </div>
    </div>
  );
}
