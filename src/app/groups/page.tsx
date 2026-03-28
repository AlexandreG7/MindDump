"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
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
import {
  Plus,
  Users,
  Crown,
  Trash2,
  UserMinus,
  Link as LinkIcon,
  Check,
  Pencil,
  X,
  Shield,
  User,
} from "lucide-react";

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
}

interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members: Member[];
  _count?: { members: number };
  owner?: { id: string; name: string | null; email: string | null };
}

export default function GroupsPage() {
  const { isReady, session } = useAuth();
  const currentUserId = session?.user?.id ?? "dev-user";

  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [memberGroups, setMemberGroups] = useState<Group[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchGroups = useCallback(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => {
        setOwnedGroups(data.owned ?? []);
        setMemberGroups(data.member ?? []);
      });
  }, []);

  useEffect(() => {
    if (isReady) fetchGroups();
  }, [isReady, fetchGroups]);

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setNewGroupName("");
    setCreateOpen(false);
    fetchGroups();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Supprimer ce groupe ? Cette action est irréversible.")) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    fetchGroups();
  };

  const leaveGroup = async (groupId: string) => {
    if (!confirm("Quitter ce groupe ?")) return;
    await fetch(`/api/groups/${groupId}/members/${currentUserId}`, { method: "DELETE" });
    fetchGroups();
  };

  const removeMember = async (groupId: string, userId: string) => {
    await fetch(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" });
    fetchGroups();
  };

  const toggleRole = async (groupId: string, userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "member" : "admin";
    await fetch(`/api/groups/${groupId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    fetchGroups();
  };

  const renameGroup = async (id: string) => {
    if (!editName.trim()) return;
    await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    fetchGroups();
  };

  const generateInvite = async (groupId: string) => {
    const res = await fetch(`/api/groups/${groupId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setInviteLinks((prev) => ({ ...prev, [groupId]: data.joinUrl }));
  };

  const copyLink = (groupId: string) => {
    const link = inviteLinks[groupId];
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedId(groupId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (!isReady) return null;

  const allGroups = [
    ...ownedGroups.map((g) => ({ ...g, isOwner: true })),
    ...memberGroups.map((g) => ({ ...g, isOwner: false })),
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groupes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allGroups.length} groupe{allGroups.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau groupe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un groupe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nom du groupe</Label>
                <Input
                  placeholder="Ex: Famille Dupont, Coloc, Équipe…"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createGroup()}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={createGroup}>
                  Créer
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Annuler</Button>
                </DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {allGroups.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Aucun groupe</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crée un groupe et invite tes proches à te rejoindre
            </p>
          </div>
        </div>
      )}

      {/* Group cards */}
      <div className="space-y-4">
        {allGroups.map((group) => (
          <div key={group.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Group header */}
            <div className="p-5 pb-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {editingId === group.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameGroup(group.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <button onClick={() => renameGroup(group.id)} className="p-1.5 rounded-lg hover:bg-secondary">
                      <Check className="h-4 w-4 text-primary" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-secondary">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg leading-tight truncate">{group.name}</h2>
                    {group.isOwner && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                        <Crown className="h-3 w-3" />
                        Propriétaire
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-0.5">
                  {group.members.length} membre{group.members.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {group.isOwner && editingId !== group.id && (
                  <button
                    onClick={() => { setEditingId(group.id); setEditName(group.name); }}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {group.isOwner ? (
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => leaveGroup(group.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Members list */}
            <div className="border-t border-border">
              {group.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                  {/* Avatar */}
                  {member.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.user.image} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-muted-foreground">
                      {(member.user.name ?? member.user.email ?? "?")[0].toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.user.name ?? member.user.email}
                      {member.user.id === currentUserId && (
                        <span className="text-muted-foreground font-normal"> (vous)</span>
                      )}
                    </p>
                    {member.user.name && member.user.email && (
                      <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                    )}
                  </div>

                  {/* Role badge */}
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    member.role === "admin"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {member.role === "admin" ? (
                      <><Shield className="h-3 w-3" />Admin</>
                    ) : (
                      <><User className="h-3 w-3" />Membre</>
                    )}
                  </span>

                  {/* Member actions (owner only, not on self) */}
                  {group.isOwner && member.user.id !== currentUserId && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleRole(group.id, member.user.id, member.role)}
                        className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title={member.role === "admin" ? "Rétrograder en membre" : "Promouvoir admin"}
                      >
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeMember(group.id, member.user.id)}
                        className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Invite section (owner / admin) */}
            {(group.isOwner || group.members.find((m) => m.user.id === currentUserId)?.role === "admin") && (
              <div className="border-t border-border p-4 bg-secondary/20">
                {inviteLinks[group.id] ? (
                  <div className="flex gap-2">
                    <Input
                      value={inviteLinks[group.id]}
                      readOnly
                      className="text-xs h-8 bg-white"
                    />
                    <Button
                      size="sm"
                      variant={copiedId === group.id ? "default" : "outline"}
                      onClick={() => copyLink(group.id)}
                      className="shrink-0"
                    >
                      {copiedId === group.id ? (
                        <><Check className="h-3.5 w-3.5 mr-1" />Copié !</>
                      ) : (
                        <><LinkIcon className="h-3.5 w-3.5 mr-1" />Copier</>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => generateInvite(group.id)}
                  >
                    <LinkIcon className="h-3.5 w-3.5 mr-2" />
                    Générer un lien d&apos;invitation
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Le lien est valide 7 jours. Quiconque possède ce lien peut rejoindre le groupe.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
