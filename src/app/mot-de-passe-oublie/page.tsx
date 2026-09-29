"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "La demande n'a pas abouti. Réessaie dans un instant.");
      else setSent(true);
    } catch {
      setError("Pas de connexion. Vérifie ton réseau, puis réessaie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <p className="text-3xl font-bold tracking-tight">MindDump</p>
          <p className="text-muted-foreground text-sm">Vide ta charge mentale</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 space-y-6">
          {sent ? (
            <div className="space-y-4" role="status">
              <MailCheck className="h-8 w-8 text-primary" aria-hidden="true" />
              <h1 className="text-xl font-semibold">Regarde tes e-mails</h1>
              <p className="text-sm text-muted-foreground">
                Si un compte MindDump utilise <span className="font-medium text-foreground">{email}</span>,
                un lien pour choisir un nouveau mot de passe vient d&apos;y être envoyé. Il reste valable
                une heure. Pense à regarder dans les indésirables.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                Utiliser une autre adresse
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Indique l&apos;adresse de ton compte : tu recevras un lien pour choisir un nouveau mot
                  de passe.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="prenom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Envoi…" : "Recevoir le lien"}
                </Button>
              </form>
            </>
          )}

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
