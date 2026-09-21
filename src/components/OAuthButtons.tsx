"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn, type ClientSafeProvider } from "next-auth/react";
import { Button } from "@/components/ui/button";

// Logos imposés par les chartes Google et Apple pour les boutons de connexion.
export function ProviderIcon({ id, className = "h-4 w-4" }: { id: string; className?: string }) {
  if (id === "google") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
      </svg>
    );
  }
  if (id === "apple") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
        <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8s2 .8 3.4.8 2.3-1.3 3.1-2.5a11 11 0 0 0 1.4-2.9 4.5 4.5 0 0 1-2.7-4zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5z" />
      </svg>
    );
  }
  return null;
}

export function OAuthButtons({ callbackUrl, label = "Continuer avec" }: { callbackUrl: string; label?: string }) {
  const [providers, setProviders] = useState<ClientSafeProvider[]>([]);

  useEffect(() => {
    getProviders().then((all) =>
      setProviders(Object.values(all ?? {}).filter((p) => p.type === "oauth"))
    );
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          className="w-full gap-2"
          size="lg"
          onClick={() => signIn(p.id, { callbackUrl })}
        >
          <ProviderIcon id={p.id} />
          {label} {p.name}
        </Button>
      ))}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

// Messages des erreurs OAuth renvoyées par NextAuth sur /login?error=…
export function oauthErrorMessage(code: string | null): string {
  if (!code) return "";
  if (code === "OAuthAccountNotLinked") {
    return "Un compte existe déjà avec cet email. Connecte-toi avec ton mot de passe, puis lie ce fournisseur depuis ton profil (section « Connexion »).";
  }
  if (code === "CredentialsSignin") return "";
  return "La connexion avec ce fournisseur a échoué. Réessaie, ou utilise ton email et ton mot de passe.";
}
