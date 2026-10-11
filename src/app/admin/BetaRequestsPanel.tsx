"use client";

import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminBetaRequest, RequestStatus } from "@/lib/betaAccess";
import { formatDate } from "./format";

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "En attente",
  invited: "Invitée",
  registered: "Inscrite",
  refused: "Refusée",
};

type Issued = { link: string; expiresAt: string };

function LinkBox({ issued }: { issued: Issued }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé : le champ reste sélectionnable à la main.
    }
  };
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-2">
        <Input readOnly value={issued.link} onFocus={(e) => e.currentTarget.select()} aria-label="Lien d'inscription" className="h-8 text-xs font-mono" />
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        À usage unique, valable jusqu&apos;au {formatDate(issued.expiresAt, true)}. Il ne sera plus affiché : transmets-le
        toi-même à cette personne (ou régénère-le).
      </p>
    </div>
  );
}

export function BetaRequestsPanel({ initial }: { initial: AdminBetaRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [issued, setIssued] = useState<Record<string, Issued>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [directEmail, setDirectEmail] = useState("");
  const [direct, setDirect] = useState<(Issued & { email: string }) | null>(null);

  const reload = async () => {
    const res = await fetch("/api/admin/beta-requests");
    if (res.ok) setRequests((await res.json()).requests);
  };

  const call = async (key: string, url: string, body?: unknown) => {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return null;
      }
      return data;
    } catch {
      setError("Une erreur réseau est survenue.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const invite = async (r: AdminBetaRequest) => {
    const data = await call(r.id, `/api/admin/beta-requests/${r.id}/invite`);
    if (data) {
      setIssued((prev) => ({ ...prev, [r.id]: data }));
      await reload();
    }
  };

  const refuse = async (r: AdminBetaRequest) => {
    if (!window.confirm(`Refuser la demande de ${r.email} ? Ses liens en cours seront invalidés.`)) return;
    if (await call(r.id, `/api/admin/beta-requests/${r.id}/refuse`)) {
      setIssued(({ [r.id]: _dropped, ...rest }) => rest);
      await reload();
    }
  };

  const createDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call("direct", "/api/admin/signup-invites", { email: directEmail });
    if (data) {
      setDirect(data);
      setDirectEmail("");
      await reload();
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Créer un lien pour un e-mail</h2>
        </div>
        <form onSubmit={createDirect} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="direct-email">Adresse à inviter</Label>
            <Input
              id="direct-email"
              type="email"
              placeholder="prenom@exemple.com"
              value={directEmail}
              onChange={(e) => setDirectEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy === "direct"}>
            Créer le lien
          </Button>
        </form>
        {direct && (
          <div>
            <p className="text-sm">
              Lien pour <span className="font-medium">{direct.email}</span>
            </p>
            <LinkBox issued={direct} />
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h2 className="text-base font-semibold">
          Demandes d&apos;accès{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({requests.filter((r) => r.status === "pending").length} en attente)
          </span>
        </h2>
        {error && (
          <p role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="py-3 space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-all">{r.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.name} · {formatDate(r.createdAt, true)}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.message && <p className="text-sm whitespace-pre-wrap break-words">{r.message}</p>}
                {r.status !== "registered" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.status === "invited" ? (
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => invite(r)}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        Régénérer le lien
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busy === r.id} onClick={() => invite(r)}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Accepter
                      </Button>
                    )}
                    {r.status !== "refused" && (
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => refuse(r)}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Refuser
                      </Button>
                    )}
                  </div>
                )}
                {r.status === "invited" && !issued[r.id] && (
                  <p className="text-xs text-muted-foreground">
                    {r.inviteExpiresAt
                      ? `Lien valable jusqu'au ${formatDate(r.inviteExpiresAt, true)}. Le lien n'est plus affiché : régénère-le pour en obtenir un nouveau.`
                      : "Le lien a expiré : régénère-le."}
                  </p>
                )}
                {issued[r.id] && <LinkBox issued={issued[r.id]} />}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Les demandes sont supprimées automatiquement après 6 mois. Les liens ne sont jamais stockés en clair.
        </p>
      </section>
    </div>
  );
}
