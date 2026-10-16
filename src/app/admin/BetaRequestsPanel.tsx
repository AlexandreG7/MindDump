"use client";

import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFeedback } from "@/components/ui/feedback";
import type { AdminBetaRequest, AdminBetaRequestsPage, AdminDirectInvite, RequestStatus } from "@/lib/betaAccess";
import { formatDate } from "./format";

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "En attente",
  invited: "Invitée",
  registered: "Inscrite",
  refused: "Refusée",
};

const DIRECT_STATUS_LABEL: Record<AdminDirectInvite["status"], string> = {
  active: "En cours",
  used: "Utilisé",
  revoked: "Remplacé",
  expired: "Expiré",
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
      <p className="text-xs font-medium text-foreground">Envoie ce lien uniquement à l&apos;adresse ci-dessus.</p>
    </div>
  );
}

const PAGE_SIZE = 50;
const RELOAD_MAX = 500;

/**
 * Onglet « Demandes d'accès ». Reste monté quand on change d'onglet (AdminDashboard :
 * `forceMount`) : liste, liens affichés et lien direct survivent à la navigation entre
 * onglets. `onPendingChange` tient à jour le compteur de l'onglet.
 */
export function BetaRequestsPanel({
  initial,
  onPendingChange,
}: {
  initial: AdminBetaRequestsPage;
  onPendingChange: (pending: number) => void;
}) {
  const { confirm } = useFeedback();
  const [requests, setRequests] = useState(initial.requests);
  const [pending, setPending] = useState(initial.pending);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [directInvites, setDirectInvites] = useState(initial.directInvites);
  const [loadingMore, setLoadingMore] = useState(false);
  const [issued, setIssued] = useState<Record<string, Issued>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [directError, setDirectError] = useState("");
  const [directEmail, setDirectEmail] = useState("");
  const [direct, setDirect] = useState<(Issued & { email: string }) | null>(null);

  const apply = (page: AdminBetaRequestsPage, append: boolean) => {
    setRequests((prev) => {
      if (!append) return page.requests;
      const known = new Set(prev.map((r) => r.id));
      return [...prev, ...page.requests.filter((r) => !known.has(r.id))];
    });
    setPending(page.pending);
    setHasMore(page.hasMore);
    setDirectInvites(page.directInvites);
    onPendingChange(page.pending);
  };

  /** Recharge ce qui est affiché (au moins la première page), ou la suite si `more`. */
  const load = async (more: boolean) => {
    try {
      const query = more
        ? `offset=${requests.length}&limit=${PAGE_SIZE}`
        : `offset=0&limit=${Math.min(RELOAD_MAX, Math.max(PAGE_SIZE, requests.length))}`;
      const res = await fetch(`/api/admin/beta-requests?${query}`);
      if (!res.ok) {
        setError("Impossible d'actualiser la liste. Recharge la page si cela continue.");
        return;
      }
      apply(await res.json(), more);
    } catch {
      setError("Impossible d'actualiser la liste (erreur réseau).");
    }
  };

  const reload = () => load(false);

  const loadMore = async () => {
    setLoadingMore(true);
    setError("");
    await load(true);
    setLoadingMore(false);
  };

  const call = async (
    key: string,
    url: string,
    body?: unknown,
    report: (message: string) => void = setError,
    method: "POST" | "DELETE" = "POST"
  ) => {
    setBusy(key);
    report("");
    try {
      const res = await fetch(url, {
        method,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        report(data.error || "Une erreur est survenue.");
        return null;
      }
      return data;
    } catch {
      report("Une erreur réseau est survenue.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const invite = async (r: AdminBetaRequest) => {
    // Régénérer un lien déjà envoyé le rend inutilisable : confirmation. Accepter une demande
    // en attente (ou refusée) ne remplace aucun lien.
    if (
      r.status === "invited" &&
      !(await confirm({
        title: "Régénérer le lien ?",
        description: `L'ancien lien de ${r.email} ne marchera plus. Un nouveau lien va être créé.`,
        confirmLabel: "Régénérer",
      }))
    ) {
      return;
    }
    const data = await call(r.id, `/api/admin/beta-requests/${r.id}/invite`);
    if (data) {
      setIssued((prev) => ({ ...prev, [r.id]: data }));
      await reload();
    }
  };

  const refuse = async (r: AdminBetaRequest) => {
    const ok = await confirm({
      title: "Refuser cette demande ?",
      description: `La demande de ${r.email} sera refusée et ses liens en cours seront invalidés.`,
      confirmLabel: "Refuser",
      destructive: true,
    });
    if (!ok) return;
    if (await call(r.id, `/api/admin/beta-requests/${r.id}/refuse`)) {
      setIssued(({ [r.id]: _dropped, ...rest }) => rest);
      await reload();
    }
  };

  const remove = async (r: AdminBetaRequest) => {
    const ok = await confirm({
      title: "Supprimer cette demande ?",
      description:
        r.status === "registered"
          ? `La demande de ${r.email} et ses liens d'invitation seront effacés. Son compte n'est pas touché.`
          : `La demande de ${r.email} et ses liens d'invitation seront effacés définitivement.`,
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    if (await call(r.id, `/api/admin/beta-requests/${r.id}`, undefined, setError, "DELETE")) {
      setIssued(({ [r.id]: _dropped, ...rest }) => rest);
      await reload();
    }
  };

  const removeDirect = async (d: AdminDirectInvite) => {
    const ok = await confirm({
      title: "Supprimer ce lien ?",
      description: `Les liens créés pour ${d.email} seront effacés et ne marcheront plus. Un éventuel compte n'est pas touché.`,
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    if (await call(d.id, `/api/admin/signup-invites/${d.id}`, undefined, setDirectError, "DELETE")) {
      setDirect((current) => (current?.email === d.email ? null : current));
      await reload();
    }
  };

  const createDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call("direct", "/api/admin/signup-invites", { email: directEmail }, setDirectError);
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
        {directError && (
          <p role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            {directError}
          </p>
        )}
        {direct && (
          <div>
            <p className="text-sm">
              Lien pour <span className="font-medium">{direct.email}</span>
            </p>
            <LinkBox issued={direct} />
          </div>
        )}
        {directInvites.length > 0 && (
          <div className="pt-2 space-y-1">
            <h3 className="text-sm font-medium">Liens directs</h3>
            <ul className="divide-y divide-border">
              {directInvites.map((d) => (
                <li key={d.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm break-all">{d.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {DIRECT_STATUS_LABEL[d.status]} · créé le {formatDate(d.createdAt, true)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Supprimer les liens de ${d.email}`}
                    title="Supprimer"
                    disabled={busy === d.id}
                    onClick={() => removeDirect(d)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h2 className="text-base font-semibold">
          Demandes d&apos;accès{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({pending} en attente)
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
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {STATUS_LABEL[r.status]}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Supprimer la demande de ${r.email}`}
                      title="Supprimer"
                      disabled={busy === r.id}
                      onClick={() => remove(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {r.message && <p className="text-sm whitespace-pre-wrap wrap-break-word">{r.message}</p>}
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
        {hasMore && (
          <div className="flex justify-center pt-1">
            <Button type="button" size="sm" variant="outline" disabled={loadingMore} onClick={loadMore}>
              Voir plus
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Les liens ne sont jamais stockés en clair. Une demande se supprime avec la corbeille, sur demande de la personne.
        </p>
      </section>
    </div>
  );
}
