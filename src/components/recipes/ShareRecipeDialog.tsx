"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Link2Off, Loader, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ShareRecipeDialog({
  open,
  onOpenChange,
  recipeId,
  recipeTitle,
  shareToken,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeTitle: string;
  shareToken: string | null;
  onChange: () => void;
}) {
  const [token, setToken] = useState(shareToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => setToken(shareToken), [shareToken]);
  useEffect(() => setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share), []);

  const url = token ? `${window.location.origin}/shared/recipes/${token}` : "";

  const createLink = async () => {
    setLoading(true);
    const res = await fetch(`/api/recipes/${recipeId}/share`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      alert("Impossible de créer le lien");
      return;
    }
    const data = await res.json();
    setToken(data.shareToken);
    onChange();
  };

  const revokeLink = async () => {
    if (!confirm("Désactiver le lien ? Les personnes qui l'ont ne pourront plus voir la recette.")) return;
    setLoading(true);
    await fetch(`/api/recipes/${recipeId}/share`, { method: "DELETE" });
    setLoading(false);
    setToken(null);
    onChange();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = () => {
    navigator.share({ title: recipeTitle, url }).catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Partager la recette</DialogTitle>
        </DialogHeader>

        {token ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Toute personne qui a ce lien peut voir la recette, même sans compte MindDump.
            </p>
            <div className="flex items-center gap-1.5">
              <Input
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="text-xs font-mono"
              />
              <button
                onClick={copyLink}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Copier le lien"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                onClick={revokeLink}
                disabled={loading}
                className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Désactiver le lien"
              >
                <Link2Off className="h-4 w-4" />
              </button>
            </div>
            {canNativeShare && (
              <Button className="w-full" onClick={nativeShare}>
                <Send className="h-4 w-4 mr-2" />
                Envoyer…
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crée un lien pour partager « {recipeTitle} ». Toute personne qui a le lien pourra
              voir la recette et l&apos;ajouter à ses recettes.
            </p>
            <Button className="w-full" onClick={createLink} disabled={loading}>
              {loading ? (
                <Loader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Créer un lien
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
