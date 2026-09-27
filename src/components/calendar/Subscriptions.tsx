"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Subscription } from "./types";

export function SubscriptionDialog({
  open,
  onOpenChange,
  groupName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string | null;
  onSubmit: (sub: { name: string; url: string }) => Promise<void>;
}) {
  const [newSub, setNewSub] = useState({ name: "", url: "" });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!newSub.name.trim() || !newSub.url.trim()) return;
    setLoading(true);
    try {
      await onSubmit(newSub);
      setNewSub({ name: "", url: "" });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer un calendrier</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dans Apple Calendar : clic droit sur un calendrier → Partager le calendrier → Calendrier public → copie
            l&apos;URL webcal://
          </p>
          <p className="text-sm text-muted-foreground">
            {groupName ? (
              <>
                Les événements seront synchronisés pour{" "}
                <span className="text-foreground font-medium">{groupName}</span> : tous les membres du groupe les
                verront dans leur calendrier.
              </>
            ) : (
              "Les événements seront synchronisés pour ton groupe : tous ses membres les verront dans leur calendrier."
            )}
          </p>
          <div>
            <Label>Nom</Label>
            <Input
              placeholder="Ex: Personnel, Boulot…"
              value={newSub.name}
              onChange={(e) => setNewSub({ ...newSub, name: e.target.value })}
            />
          </div>
          <div>
            <Label>URL du calendrier</Label>
            <Input
              placeholder="webcal://p12-caldav.icloud.com/…"
              value={newSub.url}
              onChange={(e) => setNewSub({ ...newSub, url: e.target.value })}
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={loading}>
            {loading ? "Importation…" : "Importer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionChips({
  subscriptions,
  onDelete,
}: {
  subscriptions: Subscription[];
  onDelete: (id: string) => void;
}) {
  if (subscriptions.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {subscriptions.map((sub) => (
        <div
          key={sub.id}
          className="group flex items-center gap-1.5 text-xs bg-secondary/50 rounded-full px-2.5 py-1"
          title={
            sub.groupName
              ? `Synchronisé pour ${sub.groupName}${sub.isOwner ? "" : " (ajouté par un autre membre)"}`
              : undefined
          }
        >
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
          <span>{sub.name}</span>
          {sub.groupName && (
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {sub.groupName}
            </span>
          )}
          {sub.isOwner && (
            <button
              onClick={() => onDelete(sub.id)}
              title="Retirer ce calendrier"
              className="p-0.5 touch:p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 touch:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
