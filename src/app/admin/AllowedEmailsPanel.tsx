"use client";

import { useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFeedback } from "@/components/ui/feedback";
import type { AllowedEmail } from "@/lib/signupAllowlist";
import { formatDate } from "./format";

/**
 * Section « Adresses autorisées » de l'onglet « Demandes d'accès » : ces personnes créent leur
 * compte sans lien, sur la page d'inscription, via « Tu es déjà autorisé·e ? ». Retirer une
 * adresse ne touche jamais à un compte existant (ADR 0001). Routes : /api/admin/allowed-emails (requireAdmin + même origine).
 */
export function AllowedEmailsPanel({ initial }: { initial: AllowedEmail[] }) {
  const { confirm } = useFeedback();
  const [emails, setEmails] = useState(initial);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("add");
    setError("");
    try {
      const res = await fetch("/api/admin/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }
      setEmails((prev) => [data as AllowedEmail, ...prev]);
      setEmail("");
      setNote("");
    } catch {
      setError("Une erreur réseau est survenue.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (entry: AllowedEmail) => {
    const ok = await confirm({
      title: "Retirer cette adresse ?",
      description: `${entry.email} ne pourra plus créer de compte sans lien. Si un compte existe déjà avec cette adresse, il n'est pas touché.`,
      confirmLabel: "Retirer",
      destructive: true,
    });
    if (!ok) return;
    setBusy(entry.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/allowed-emails/${entry.id}`, { method: "DELETE" });
      // 404 : déjà retirée ailleurs, la liste est simplement à jour.
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Une erreur est survenue.");
        return;
      }
      setEmails((prev) => prev.filter((x) => x.id !== entry.id));
    } catch {
      setError("Une erreur réseau est survenue.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-3" aria-labelledby="allowed-emails-title">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="allowed-emails-title" className="text-base font-semibold">
          Adresses autorisées
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Ces personnes peuvent créer leur compte sans lien, sur la page d’inscription, via « Tu es déjà autorisé·e ? ».
      </p>
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="allowed-email">Ajouter un e-mail</Label>
          <Input
            id="allowed-email"
            type="email"
            placeholder="prenom@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="allowed-note">Note (facultatif)</Label>
          <Input id="allowed-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
        </div>
        <Button type="submit" disabled={busy === "add"}>
          Ajouter
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune adresse pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y divide-border">
          {emails.map((entry) => (
            <li key={entry.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm break-all">{entry.email}</p>
                <p className="text-xs text-muted-foreground">
                  Ajoutée le {formatDate(entry.createdAt, true)}
                  {entry.note ? ` · ${entry.note}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Retirer ${entry.email} des adresses autorisées`}
                title="Retirer"
                disabled={busy === entry.id}
                onClick={() => remove(entry)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
