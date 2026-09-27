"use client";

import { useEffect, useState } from "react";
import { LogOut, Smartphone } from "lucide-react";

type Device = { id: string; name: string; platform: string; createdAt: string; lastSeenAt: string };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Section « Appareils connectés » du profil : téléphones connectés par l'app
 * mobile (docs/app-mobile.md, étape 2.2). Absente tant qu'il n'y en a aucun.
 */
export function ConnectedDevices() {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    fetch("/api/users/me/devices")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDevices)
      .catch(() => {});
  }, []);

  const revoke = async (id: string) => {
    const previous = devices;
    setDevices((list) => list.filter((d) => d.id !== id));
    const res = await fetch(`/api/users/me/devices/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) setDevices(previous);
  };

  if (devices.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Appareils connectés</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-1">
        Téléphones sur lesquels l&apos;app MindDump est connectée à ton compte.
      </p>
      <div className="space-y-1">
        {devices.map((device) => (
          <div key={device.id} className="flex items-center gap-3 py-2 px-1">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{device.name}</p>
              <p className="text-xs text-muted-foreground">
                Dernière utilisation le {formatDate(device.lastSeenAt)}
              </p>
            </div>
            <button
              onClick={() => revoke(device.id)}
              title="Déconnecter cet appareil"
              aria-label={`Déconnecter ${device.name}`}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
