"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Check, KeyRound, LogIn, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderIcon } from "@/components/OAuthButtons";

interface Methods {
  hasPassword: boolean;
  providers: { id: string; name: string; linked: boolean }[];
}

// Retour de liaison : /profile?link=ok|taken|error&provider=google
const LINK_MESSAGES: Record<string, (name: string) => { text: string; ok: boolean }> = {
  ok: (name) => ({ text: `Ton compte ${name} est lié : tu peux maintenant l'utiliser pour te connecter.`, ok: true }),
  taken: (name) => ({ text: `Ce compte ${name} est déjà lié à un autre compte MindDump.`, ok: false }),
  error: (name) => ({ text: `La liaison avec ${name} a échoué. Réessaie.`, ok: false }),
};

export function LoginMethods() {
  const [methods, setMethods] = useState<Methods | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [linkResult, setLinkResult] = useState<{ status: string; provider: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/users/me/accounts");
    if (res.ok) setMethods(await res.json());
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const status = params.get("link");
    const provider = params.get("provider");
    if (status && provider && LINK_MESSAGES[status]) {
      setLinkResult({ status, provider });
      window.history.replaceState(null, "", "/profile#connexion");
    }
  }, [load]);

  // Message de retour de liaison, une fois les noms des fournisseurs connus.
  useEffect(() => {
    if (!linkResult || !methods) return;
    const name = methods.providers.find((p) => p.id === linkResult.provider)?.name ?? linkResult.provider;
    setMessage(LINK_MESSAGES[linkResult.status](name));
    setLinkResult(null);
  }, [linkResult, methods]);

  const link = async (id: string) => {
    setBusy(id);
    setMessage(null);
    const res = await fetch("/api/users/me/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ text: data.error || "La liaison a échoué.", ok: false });
      setBusy(null);
      return;
    }
    const { nonce } = await res.json();
    // Le nonce relie ce retour OAuth à l'intention de liaison (voir accountLinking.ts).
    await signIn(id, { callbackUrl: `/profile?link=ok&provider=${id}&li=${nonce}#connexion` });
  };

  const unlink = async (id: string, name: string) => {
    if (!confirm(`Délier ${name} ? Tu ne pourras plus te connecter avec ce compte.`)) return;
    setBusy(id);
    setMessage(null);
    const res = await fetch(`/api/users/me/accounts?provider=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? { text: `${name} a été délié.`, ok: true } : { text: data.error, ok: false });
    setBusy(null);
    load();
  };

  if (!methods || (methods.providers.length === 0 && methods.hasPassword)) return null;

  const methodCount = methods.providers.filter((p) => p.linked).length + (methods.hasPassword ? 1 : 0);

  return (
    <section id="connexion" className="bg-card border border-border rounded-2xl p-6 space-y-4 scroll-mt-24">
      <div className="flex items-center gap-2">
        <LogIn className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Connexion</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-1">
        Les moyens que tu peux utiliser pour te connecter à ce compte.
      </p>

      <div className="space-y-1">
        <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/30">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">Email et mot de passe</span>
          <span className="text-xs text-muted-foreground">
            {methods.hasPassword ? "Actif" : "Non défini"}
          </span>
        </div>

        {methods.providers.map((p) => (
          <div key={p.id} className="group flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/30">
            <ProviderIcon id={p.id} />
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            {p.linked ? (
              <>
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <Check className="h-3 w-3" />Lié
                </span>
                <button
                  onClick={() => unlink(p.id, p.name)}
                  disabled={busy !== null || methodCount < 2}
                  title={methodCount < 2 ? "Seul moyen de connexion : impossible de le retirer" : `Délier ${p.name}`}
                  aria-label={`Délier ${p.name}`}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => link(p.id)} disabled={busy !== null}>
                {busy === p.id ? "Redirection…" : "Lier"}
              </Button>
            )}
          </div>
        ))}
      </div>

      {message && (
        <p
          className={
            message.ok
              ? "text-sm text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-500/15 px-3 py-2 rounded-lg"
              : "text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
          }
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
