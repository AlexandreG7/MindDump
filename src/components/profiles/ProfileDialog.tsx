"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { EVENT_COLORS } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { ProfileAvatar, type FamilyProfile } from "./ProfileAvatar";

const EMOJI_SUGGESTIONS = ["🦊", "🐻", "🐼", "🦁", "🐯", "🐸", "🦄", "🐙", "🚀", "⚽", "🌸", "⭐"];

export type ProfileDraft = Pick<FamilyProfile, "name" | "kind" | "color" | "emoji" | "birthDate">;

/** Création ou modification d'une personne du foyer. */
export function ProfileDialog({
  open,
  onOpenChange,
  profile,
  defaultColor,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: FamilyProfile | null;
  defaultColor: string;
  onSave: (draft: ProfileDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProfileDraft>({
    name: "", kind: "child", color: defaultColor, emoji: null, birthDate: null,
  });
  const [saving, setSaving] = useState(false);
  const isMember = !!profile?.userId;

  useEffect(() => {
    if (!open) return;
    setDraft(
      profile
        ? { name: profile.name, kind: profile.kind, color: profile.color, emoji: profile.emoji, birthDate: profile.birthDate }
        : { name: "", kind: "child", color: defaultColor, emoji: null, birthDate: null }
    );
  }, [open, profile, defaultColor]);

  const save = async () => {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{profile ? "Modifier" : "Ajouter une personne"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ProfileAvatar profile={{ ...draft, name: draft.name || "?" }} size="lg" />
            <div className="flex-1 space-y-1.5">
              <Label>Prénom</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder="Ex : Léa"
                maxLength={60}
                autoFocus
              />
            </div>
          </div>

          {!isMember && (
            <div className="flex gap-2">
              {(["child", "adult"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setDraft({ ...draft, kind })}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    draft.kind === kind
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {kind === "child" ? "Enfant" : "Adulte sans compte"}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setDraft({ ...draft, color: c.value })}
                  className="w-7 h-7 rounded-full flex items-center justify-center ring-offset-2 ring-offset-background transition-shadow"
                  style={{ backgroundColor: c.value, boxShadow: draft.color === c.value ? `0 0 0 2px ${c.value}` : undefined }}
                >
                  {draft.color === c.value && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, emoji: null })}
                className={cn(
                  "h-8 px-2 rounded-lg text-xs border transition-colors",
                  !draft.emoji ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-secondary"
                )}
              >
                Initiale
              </button>
              {EMOJI_SUGGESTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setDraft({ ...draft, emoji })}
                  className={cn(
                    "w-8 h-8 rounded-lg text-lg border transition-colors",
                    draft.emoji === emoji ? "border-primary bg-primary/10" : "border-transparent hover:bg-secondary"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {!isMember && (
            <p className="text-xs text-muted-foreground">
              {draft.kind === "child" ? "Un enfant" : "Cette personne"} n&apos;a pas de compte : elle
              apparaît dans le foyer mais ne peut pas se connecter. Les membres du groupe gèrent son profil.
            </p>
          )}

          {draft.kind === "child" && !isMember && (
            <div className="space-y-1.5">
              <Label>Date de naissance <span className="text-muted-foreground font-normal">(facultatif)</span></Label>
              <Input
                type="date"
                value={draft.birthDate ?? ""}
                onChange={(e) => setDraft({ ...draft, birthDate: e.target.value || null })}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={!draft.name.trim() || saving}>
              {profile ? "Enregistrer" : "Ajouter"}
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
