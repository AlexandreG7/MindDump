"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Eye, EyeOff } from "lucide-react";

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("jeton") ?? "");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < MIN_LENGTH) {
      setError(`Choisis au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Le changement n'a pas abouti. Réessaie dans un instant.");
      else setDone(true);
    } catch {
      setError("Pas de connexion. Vérifie ton réseau, puis réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const invalidLink = token === "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <p className="text-3xl font-bold tracking-tight">MindDump</p>
          <p className="text-muted-foreground text-sm">Vide ta charge mentale</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 space-y-6">
          {done ? (
            <div className="space-y-4" role="status">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
              <h1 className="text-xl font-semibold">Mot de passe changé</h1>
              <p className="text-sm text-muted-foreground">
                Tu peux te connecter avec ton nouveau mot de passe. Par sécurité, l&apos;app mobile te
                demandera de te reconnecter.
              </p>
              <Button asChild className="w-full" size="lg">
                <Link href="/login">Se connecter</Link>
              </Button>
            </div>
          ) : invalidLink ? (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold">Lien incomplet</h1>
              <p className="text-sm text-muted-foreground">
                Ce lien ne contient pas de jeton. Ouvre le lien reçu par e-mail en entier, ou demande-en
                un nouveau.
              </p>
              <Button asChild className="w-full">
                <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
                <p className="text-sm text-muted-foreground mt-1">Au moins {MIN_LENGTH} caractères.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={MIN_LENGTH}
                      autoComplete="new-password"
                      autoFocus
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      onClick={() => setShow(!show)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirmer</Label>
                  <Input
                    id="confirm-password"
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg space-y-1">
                    <p>{error}</p>
                    {error.includes("plus valable") && (
                      <Link href="/mot-de-passe-oublie" className="font-medium underline underline-offset-2">
                        Demander un nouveau lien
                      </Link>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading || token === null}>
                  {loading ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
