"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { EVENT_COLORS } from "@/lib/recurrence";
import { ProfileAvatar, type FamilyProfile } from "./ProfileAvatar";
import { ProfileDialog, type ProfileDraft } from "./ProfileDialog";

/**
 * Personnes du foyer d'un groupe : les membres (profil créé avec l'adhésion)
 * et les personnes sans compte, comme les enfants.
 */
export function FamilyProfiles({
  groupId,
  currentUserId,
  isAdmin,
}: {
  groupId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyProfile | null>(null);

  const fetchProfiles = useCallback(() => {
    fetch(`/api/groups/${groupId}/profiles`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setProfiles)
      .catch(() => {});
  }, [groupId]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const canEdit = (p: FamilyProfile) => !p.userId || p.userId === currentUserId || isAdmin;

  const save = async (draft: ProfileDraft) => {
    const res = editing
      ? await fetch(`/api/profiles/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        })
      : await fetch(`/api/groups/${groupId}/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Erreur");
    fetchProfiles();
  };

  const remove = async (p: FamilyProfile) => {
    const note = p.kind === "child" ? " Son semainier sera supprimé." : "";
    if (!confirm(`Retirer ${p.name} du foyer ?${note}`)) return;
    await fetch(`/api/profiles/${p.id}`, { method: "DELETE" });
    fetchProfiles();
  };

  const usedColors = profiles.map((p) => p.color);
  const defaultColor = (EVENT_COLORS.find((c) => !usedColors.includes(c.value)) ?? EVENT_COLORS[0]).value;

  return (
    <div className="border-t border-border px-5 py-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Personnes du foyer
      </p>
      <div className="flex flex-wrap gap-2">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="group/profile flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-border bg-card"
          >
            <ProfileAvatar profile={p} size="sm" />
            <span className="text-sm">{p.name}</span>
            {!p.userId && (
              <span className="text-[10px] text-muted-foreground" title="Sans compte : ne peut pas se connecter">
                {p.kind === "child" ? "enfant" : "sans compte"}
              </span>
            )}
            {canEdit(p) && (
              <button
                onClick={() => { setEditing(p); setDialogOpen(true); }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover/profile:opacity-100 focus:opacity-100 transition-opacity"
                title="Modifier"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {!p.userId && (
              <button
                onClick={() => remove(p)}
                className="p-0.5 -ml-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover/profile:opacity-100 focus:opacity-100 transition-opacity"
                title="Retirer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un enfant
        </button>
      </div>

      <ProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={editing}
        defaultColor={defaultColor}
        onSave={save}
      />
    </div>
  );
}
