"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Link as LinkIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFeedback } from "@/components/ui/feedback";

interface PendingInvite {
  id: string;
  email?: string | null;
  joinUrl?: string;
  expiresAt: string;
}

const MAX_INVITES = 5;

/**
 * Liens d'invitation d'un groupe (propriétaire / admin). Avec l'e-mail de la personne, le lien
 * est nominatif : elle pourra aussi créer son compte. Sans e-mail, il sert seulement à quelqu'un
 * qui a déjà un compte (src/lib/groupInviteSignup.ts). 5 liens en attente au plus : chacun peut
 * être révoqué ici pour libérer une place.
 */
export function GroupInvites({ groupId }: { groupId: string }) {
  const { confirm, toast } = useFeedback();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/groups/${groupId}/invite`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setInvites(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [groupId]);

  useEffect(load, [load]);

  const copy = async (invite: PendingInvite) => {
    if (!invite.joinUrl) return;
    try {
      await navigator.clipboard.writeText(invite.joinUrl);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast("Impossible de copier le lien. Sélectionne-le puis copie-le à la main.", "error");
    }
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Le lien n'a pas pu être créé. Réessaie dans un instant.", "error");
        return;
      }
      setEmail("");
      setInvites((prev) => [...prev, data]);
      await copy(data);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (invite: PendingInvite) => {
    if (
      !(await confirm({
        title: "Supprimer cette invitation ?",
        description: "Le lien cessera de fonctionner. Tu pourras en créer un autre.",
        confirmLabel: "Supprimer",
        destructive: true,
      }))
    )
      return;
    const res = await fetch(`/api/groups/${groupId}/invite/${invite.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data.error || "L'invitation n'a pas pu être supprimée.", "error");
      return;
    }
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
  };

  const full = invites.length >= MAX_INVITES;

  return (
    <div className="border-t border-border p-4 bg-secondary/20 space-y-3">
      {invites.length > 0 && (
        <ul className="space-y-1.5" aria-label="Invitations en attente">
          {invites.map((invite) => (
            <li key={invite.id} className="group/invite flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">
                {invite.email ? (
                  <span className="font-medium">{invite.email}</span>
                ) : (
                  <span className="text-muted-foreground">Lien sans e-mail (compte existant)</span>
                )}
                <span className="text-muted-foreground">
                  {" "}· jusqu&apos;au {new Date(invite.expiresAt).toLocaleDateString("fr-FR")}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => copy(invite)}
                aria-label="Copier le lien d'invitation"
              >
                {copiedId === invite.id ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => revoke(invite)}
                aria-label="Supprimer l'invitation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={generate} className="space-y-2">
        <Label htmlFor={`invite-email-${groupId}`} className="text-xs">
          E-mail de la personne invitée (facultatif)
        </Label>
        <div className="flex gap-2">
          <Input
            id={`invite-email-${groupId}`}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="prenom@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 bg-card text-sm"
          />
          <Button type="submit" size="sm" variant="outline" className="shrink-0 h-9" disabled={creating || full}>
            <LinkIcon className="h-3.5 w-3.5 mr-2" />
            Générer un lien
          </Button>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        Avec son e-mail, la personne pourra créer son compte. Sans e-mail, le lien sert seulement à quelqu&apos;un qui a déjà un compte.
        Le lien est valide 7 jours et ne sert qu&apos;une fois.
        {full ? ` ${MAX_INVITES} invitations en attente au maximum : supprime-en une.` : ""}
      </p>
    </div>
  );
}
