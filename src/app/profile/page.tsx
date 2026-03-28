"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGroupContext } from "@/components/GroupContext";
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
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  CheckSquare,
  Calendar,
  ShoppingCart,
  ChefHat,
  Sliders,
} from "lucide-react";
import { useFeaturesContext, type FeatureKey } from "@/components/FeaturesContext";

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
  isDefault: boolean;
  createdAt: string;
  members: Member[];
}

export default function ProfilePage() {
  const { isReady, session } = useAuth();
  const { refresh: refreshGroups } = useGroupContext();
  const currentUserId = session?.user?.id ?? "dev-user";
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const userImage = session?.user?.image;

  // ── Groups state ──────────────────────────────────────────────
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [memberGroups, setMemberGroups] = useState<Group[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // ── Password state ────────────────────────────────────────────
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

  // ── Feature flags ─────────────────────────────────────────────
  const { flags, toggle: toggleFeature } = useFeaturesContext();

  const FEATURE_ITEMS: { key: FeatureKey; label: string; description: string; icon: React.ElementType }[] = [
    { key: "todos", label: "Todos", description: "Liste de tâches et rappels", icon: CheckSquare },
    { key: "calendar", label: "Calendrier", description: "Événements et planning", icon: Calendar },
    { key: "lists", label: "Courses", description: "Listes de courses", icon: ShoppingCart },
    { key: "recipes", label: "Recettes", description: "Catalogue et planification", icon: ChefHat },
  ];

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

  const allGroups = [
    ...ownedGroups.map((g) => ({ ...g, isOwner: true })),
    ...memberGroups.map((g) => ({ ...g, isOwner: false })),
  ];

  // ── Group actions ─────────────────────────────────────────────
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
    refreshGroups();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Supprimer ce groupe ? Cette action est irréversible.")) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    fetchGroups();
    refreshGroups();
  };

  const leaveGroup = async (groupId: string) => {
    if (!confirm("Quitter ce groupe ?")) return;
    await fetch(`/api/groups/${groupId}/members/${currentUserId}`, { method: "DELETE" });
    fetchGroups();
    refreshGroups();
  };

  const removeMember = async (groupId: string, userId: string) => {
    await fetch(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" });
    fetchGroups();
  };

  const toggleRole = async (groupId: string, userId: string, currentRole: string) => {
    await fetch(`/api/groups/${groupId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: currentRole === "admin" ? "member" : "admin" }),
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
    refreshGroups();
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

  // ── Password change ───────────────────────────────────────────
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess(false);

    if (pwdNew !== pwdConfirm) {
      setPwdError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (pwdNew.length < 8) {
      setPwdError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setPwdLoading(true);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }),
    });
    setPwdLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setPwdError(data.error || "Erreur lors du changement de mot de passe.");
    } else {
      setPwdSuccess(true);
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
    }
  };

  if (!isReady) return null;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gère ton compte et tes groupes</p>
      </div>

      {/* ── Infos compte ────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-semibold">Mon compte</h2>
        <div className="flex items-center gap-4">
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userImage} alt="" className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {(userName || userEmail || "?")[0].toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-base">{userName || "—"}</p>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
        </div>
      </section>

      {/* ── Changer le mot de passe ─────────────────────────────── */}
      {!skipAuth && (
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Changer le mot de passe</h2>
          </div>
          <form onSubmit={changePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nouveau mot de passe</Label>
                <Input type={showPwd ? "text" : "password"} value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)} placeholder="8 caractères min." />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmer</Label>
                <Input type={showPwd ? "text" : "password"} value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            {pwdError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{pwdError}</p>
            )}
            {pwdSuccess && (
              <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg flex items-center gap-2">
                <Check className="h-4 w-4" />Mot de passe modifié avec succès.
              </p>
            )}
            <Button type="submit" size="sm" disabled={pwdLoading}>
              {pwdLoading ? "Enregistrement…" : "Changer le mot de passe"}
            </Button>
          </form>
        </section>
      )}

      {/* ── Feature flags ───────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Fonctionnalités</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-1">
          Active ou désactive les onglets de navigation.
        </p>
        <div className="space-y-1">
          {FEATURE_ITEMS.map(({ key, label, description, icon: Icon }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 py-3 px-1 rounded-xl hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  flags[key] ? "bg-primary/10" : "bg-secondary"
                }`}>
                  <Icon className={`h-4 w-4 transition-colors ${flags[key] ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium transition-colors ${!flags[key] && "text-muted-foreground"}`}>
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={flags[key]}
                onClick={() => toggleFeature(key, !flags[key])}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 ${
                  flags[key] ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    flags[key] ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mes groupes ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Mes groupes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {allGroups.length} groupe{allGroups.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />Nouveau groupe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer un groupe</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nom du groupe</Label>
                  <Input placeholder="Ex: Famille, Coloc, Équipe…" value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createGroup()} autoFocus />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={createGroup}>Créer</Button>
                  <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {allGroups.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">Aucun groupe</p>
              <p className="text-sm text-muted-foreground mt-1">Crée un groupe et invite tes proches</p>
            </div>
          </div>
        )}

        {allGroups.map((group) => (
          <div key={group.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Group header */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {editingId === group.id ? (
                  <div className="flex gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") renameGroup(group.id); if (e.key === "Escape") setEditingId(null); }}
                      className="h-7 text-sm" autoFocus />
                    <button onClick={() => renameGroup(group.id)} className="p-1 rounded hover:bg-secondary">
                      <Check className="h-4 w-4 text-primary" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-secondary">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{group.name}</span>
                    {group.isDefault && (
                      <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full shrink-0">défaut</span>
                    )}
                    {group.isOwner && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">
                        <Crown className="h-2.5 w-2.5" />Propriétaire
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {group.members.length} membre{group.members.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {group.isOwner && editingId !== group.id && (
                  <button onClick={() => { setEditingId(group.id); setEditName(group.name); }}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {group.isOwner ? (
                  <button onClick={() => deleteGroup(group.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button onClick={() => leaveGroup(group.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Members */}
            <div className="border-t border-border">
              {group.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                  {member.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.user.image} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
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
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    member.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                  }`}>
                    {member.role === "admin" ? <><Shield className="h-2.5 w-2.5" />Admin</> : <><User className="h-2.5 w-2.5" />Membre</>}
                  </span>
                  {group.isOwner && member.user.id !== currentUserId && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleRole(group.id, member.user.id, member.role)}
                        title={member.role === "admin" ? "Rétrograder" : "Promouvoir admin"}
                        className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeMember(group.id, member.user.id)}
                        className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Invite */}
            {(group.isOwner || group.members.find((m) => m.user.id === currentUserId)?.role === "admin") && (
              <div className="border-t border-border p-3 bg-secondary/20">
                {inviteLinks[group.id] ? (
                  <div className="flex gap-2">
                    <Input value={inviteLinks[group.id]} readOnly className="text-xs h-8 bg-white" />
                    <Button size="sm" variant={copiedId === group.id ? "default" : "outline"}
                      onClick={() => copyLink(group.id)} className="shrink-0">
                      {copiedId === group.id
                        ? <><Check className="h-3.5 w-3.5 mr-1" />Copié !</>
                        : <><LinkIcon className="h-3.5 w-3.5 mr-1" />Copier</>}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => generateInvite(group.id)}>
                    <LinkIcon className="h-3.5 w-3.5 mr-2" />Générer un lien d&apos;invitation
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1.5">Lien valide 7 jours</p>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
