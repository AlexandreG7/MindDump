"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useGroupContext } from "@/components/GroupContext";
import { useFamilyProfiles } from "@/components/profiles/Assignees";
import { AiImportDialog, useAiImportStatus } from "@/components/import/AiImportDialog";

interface SharedFilePlugin {
  take: () => Promise<{ name: string; mimeType: string; data: string } | null>;
}

/** Plugin natif de l'app Android : le fichier partagé, rendu une seule fois. */
function sharedFilePlugin(): SharedFilePlugin | null {
  const w = window as unknown as { Capacitor?: { Plugins?: { SharedFile?: SharedFilePlugin } } };
  return w.Capacitor?.Plugins?.SharedFile ?? null;
}

function base64ToFile(data: string, name: string, type: string): File {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name || "document", { type });
}

/**
 * Ouvre l'import IA, avec le fichier partagé depuis une autre app s'il y en a
 * un ; sans fichier, la page sert d'import manuel.
 */
export function ImportReceiver() {
  const { isReady } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { currentGroupId } = useGroupContext();
  const profiles = useFamilyProfiles(currentGroupId);
  const [status, setStatus] = useAiImportStatus();
  const [file, setFile] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const imported = useRef(false);
  const taken = useRef(false);

  useEffect(() => {
    if (!isReady || taken.current) return;
    taken.current = true;
    (async () => {
      const plugin = params.get("shared") === "1" ? sharedFilePlugin() : null;
      if (plugin) {
        const shared = await plugin.take().catch(() => null);
        if (shared?.data) setFile(base64ToFile(shared.data, shared.name, shared.mimeType));
      }
      setReady(true);
    })();
  }, [isReady, params]);

  useEffect(() => {
    if (ready && status?.enabled) setOpen(true);
  }, [ready, status?.enabled]);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) router.replace(imported.current ? "/calendar" : "/");
  };

  if (status && !status.enabled) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-12 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Import indisponible</h1>
        <p className="text-sm text-muted-foreground">
          L&apos;import avec l&apos;IA n&apos;est pas activé sur ce serveur.
        </p>
        <Link href="/calendar" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Aller à l&apos;agenda
        </Link>
      </div>
    );
  }

  return (
    <>
      {!open && (
        <div className="flex justify-center py-16" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Chargement" />
        </div>
      )}
      <AiImportDialog
        open={open}
        onOpenChange={close}
        groupId={currentGroupId}
        profiles={profiles.assignable}
        status={status}
        onStatusChange={setStatus}
        onImported={() => {
          imported.current = true;
        }}
        initialFile={file}
      />
    </>
  );
}
