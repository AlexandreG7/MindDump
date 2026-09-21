"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { ShieldCheck } from "lucide-react";

export function ConsentForm({
  alreadyConsented,
  callbackUrl,
}: {
  alreadyConsented: boolean;
  callbackUrl: string;
}) {
  const { update } = useSession();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Rafraîchit le jeton (consented=true) puis repart vers la page demandée.
  // Navigation complète : le middleware doit relire le nouveau cookie.
  const continueToApp = async () => {
    await update();
    window.location.assign(callbackUrl);
  };

  useEffect(() => {
    if (alreadyConsented) continueToApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyConsented]);

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!consent) {
      setError("Coche la case pour continuer.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/users/me/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    await continueToApp();
  };

  if (alreadyConsented) return null;

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-sm p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Avant de continuer</h1>
            <p className="text-sm text-muted-foreground">Une étape, une seule fois.</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            MindDump conserve ce que tu y ranges (todos, calendrier, listes, recettes…) pour te
            le restituer et le partager avec les groupes que tu choisis. Rien n&apos;est revendu,
            et aucun traceur publicitaire ou de mesure d&apos;audience n&apos;est utilisé.
          </p>
          <p>
            Pour utiliser l&apos;application, nous avons besoin de ton accord sur notre{" "}
            <Link href="/confidentialite" target="_blank" className="text-primary font-medium hover:underline">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>

        <form onSubmit={accept} className="space-y-4">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
              aria-required="true"
            />
            <Label htmlFor="consent" className="text-sm font-normal leading-snug text-muted-foreground">
              J&apos;accepte la politique de confidentialité et le traitement de mes données pour
              le fonctionnement de MindDump.
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enregistrement…" : "Accepter et continuer"}
          </Button>
        </form>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Refuser et me déconnecter
          </button>
          <DeleteAccountDialog
            trigger={
              <button className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Supprimer mon compte
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}
