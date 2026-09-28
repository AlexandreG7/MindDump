"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, Copy, ExternalLink, MonitorSmartphone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WallDevice {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
}

/**
 * Écrans muraux du groupe (admins) : une tablette affiche le tableau du foyer
 * via un lien secret, montré une seule fois à la création.
 */
export function WallDevices({ groupId }: { groupId: string }) {
  const [devices, setDevices] = useState<WallDevice[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDevices = useCallback(() => {
    fetch(`/api/groups/${groupId}/walls`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setDevices)
      .catch(() => {});
  }, [groupId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const create = async () => {
    const res = await fetch(`/api/groups/${groupId}/walls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setCreated({ id: data.id, url: `${window.location.origin}${data.path}` });
    setCopied(false);
    setName("");
    setAdding(false);
    fetchDevices();
  };

  const revoke = async (device: WallDevice) => {
    if (!confirm(`Déconnecter « ${device.name} » ? Son lien cessera de fonctionner.`)) return;
    await fetch(`/api/walls/${device.id}`, { method: "DELETE" });
    if (created?.id === device.id) setCreated(null);
    fetchDevices();
  };

  const copy = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-t border-border px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Écrans muraux</p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter un écran
          </button>
        )}
      </div>

      {devices.length === 0 && !adding && !created && (
        <p className="text-sm text-muted-foreground">
          Transforme une tablette en calendrier familial : semaine, tâches, courses et menu du foyer, toujours affichés.
        </p>
      )}

      {adding && (
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Ex : Tablette de la cuisine"
            className="h-9"
            autoFocus
          />
          <Button size="sm" onClick={create}>
            Créer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
            Annuler
          </Button>
        </div>
      )}

      {created && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
          <p className="text-sm font-medium">Ouvre ce lien sur la tablette, puis ajoute-le à l&apos;écran d&apos;accueil.</p>
          <div className="flex gap-2">
            <Input value={created.url} readOnly className="h-8 text-xs font-mono bg-card" />
            <Button size="sm" variant={copied ? "default" : "outline"} onClick={copy} className="shrink-0" aria-label="Copier le lien">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="outline" asChild className="shrink-0">
              <a href={created.url} target="_blank" rel="noreferrer" aria-label="Ouvrir l'écran">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ce lien ne sera plus affiché. Quiconque l&apos;a voit le tableau du groupe et peut cocher tâches et
            courses : garde-le pour la tablette. Pour le couper, déconnecte l&apos;écran ci-dessous.
          </p>
        </div>
      )}

      {devices.length > 0 && (
        <ul className="space-y-1">
          {devices.map((d) => (
            <li key={d.id} className="group/wall flex items-center gap-3 py-1.5">
              <MonitorSmartphone className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.lastSeenAt
                    ? `Vu ${formatDistanceToNow(new Date(d.lastSeenAt), { locale: fr, addSuffix: true })}`
                    : "Jamais connecté"}
                </p>
              </div>
              <button
                onClick={() => revoke(d)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/wall:opacity-100 focus:opacity-100 touch:opacity-100 transition-opacity"
                title="Déconnecter cet écran"
                aria-label={`Déconnecter ${d.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
