"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const CONFIRMATION = "SUPPRIMER";

export function DeleteAccountDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  // Choix explicite, sans valeur par défaut (voir deleteUserAccount).
  const [keepShared, setKeepShared] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setConfirmText("");
    setPassword("");
    setKeepShared(null);
    setError("");
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/users/me/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirmText.trim(), password: password || undefined, keepShared }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "La suppression a échoué.");
      setLoading(false);
      return;
    }
    await signOut({ callbackUrl: "/" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supprimer mon compte</DialogTitle>
        </DialogHeader>
        <form onSubmit={deleteAccount} className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Cette action est <strong className="text-foreground">définitive</strong>. Seront
              supprimés : tout ce que tu n&apos;as partagé avec personne (todos, événements, listes,
              recettes et leurs photos), ton semainier, tes abonnements calendrier, tes clés API et
              ton historique de connexion.
            </p>
            <p>
              Tes groupes qui ont encore des membres sont transmis à l&apos;un d&apos;eux ; les
              autres sont supprimés. Ce que les autres membres ont ajouté n&apos;est jamais touché.
            </p>
            <p>Pense à exporter tes données avant, si tu veux les garder.</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-1.5">
              Ce que tu as ajouté dans des groupes avec d&apos;autres membres
            </legend>
            <p className="text-xs text-muted-foreground -mt-1 mb-1">
              Y compris ton groupe par défaut, si tu y as invité quelqu&apos;un.
            </p>
            {[
              {
                value: true,
                label: "Le laisser aux autres membres",
                hint: "Listes, recettes, todos et événements partagés restent dans le groupe.",
              },
              {
                value: false,
                label: "Tout supprimer",
                hint: "Ces éléments disparaissent aussi pour les autres membres.",
              },
            ].map((option) => (
              <label
                key={String(option.value)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${
                  keepShared === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                }`}
              >
                <input
                  type="radio"
                  name="keep-shared"
                  className="mt-1 accent-[hsl(var(--primary))]"
                  checked={keepShared === option.value}
                  onChange={() => setKeepShared(option.value)}
                />
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">
              Tape <span className="font-mono font-semibold">{CONFIRMATION}</span> pour confirmer
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Mot de passe</Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Laisse vide si tu te connectes avec Google"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              className="flex-1"
              disabled={loading || keepShared === null || confirmText.trim() !== CONFIRMATION}
            >
              {loading ? "Suppression…" : "Supprimer définitivement"}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
