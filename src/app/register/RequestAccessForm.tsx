"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Send } from "lucide-react";

const MESSAGE_MAX = 500;

/** Demande d'accès à la bêta privée : la réponse est la même dans tous les cas. */
export function RequestAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!consent) {
      setError("Tu dois accepter la politique de confidentialité pour envoyer ta demande.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/beta-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }
      setSent(true);
    } catch {
      setError("Impossible d'envoyer la demande. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">MindDump</h1>
          <p className="text-muted-foreground text-sm">Vide ta charge mentale</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 space-y-6">
          {sent ? (
            <div className="space-y-3" role="status">
              <h2 className="text-xl font-semibold">Merci, on revient vers toi</h2>
              <p className="text-sm text-muted-foreground">
                Si ta demande est acceptée, tu recevras un lien d&apos;inscription personnel.
              </p>
              <p className="text-sm">
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold">Demander un accès à la bêta</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  MindDump est en bêta privée. Laisse-nous ton adresse, on te répond avec un lien d&apos;inscription.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Déjà un compte ?{" "}
                  <Link href="/login" className="text-primary font-medium hover:underline">
                    Se connecter
                  </Link>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Prénom</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Alex"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                    autoComplete="given-name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="prenom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Un mot sur ton envie d&apos;essayer (facultatif)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={MESSAGE_MAX}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {message.length} / {MESSAGE_MAX}
                  </p>
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <Checkbox
                    id="consent"
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v === true)}
                    className="mt-0.5"
                    aria-required="true"
                  />
                  <Label htmlFor="consent" className="text-sm font-normal leading-snug text-muted-foreground">
                    J&apos;accepte la{" "}
                    <Link
                      href="/confidentialite"
                      target="_blank"
                      className="text-primary font-medium hover:underline"
                    >
                      politique de confidentialité
                    </Link>{" "}
                    et que MindDump conserve ma demande pour y répondre.
                  </Label>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    {loading ? "Envoi…" : "Envoyer ma demande"}
                  </span>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
