"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OAuthButtons } from "@/components/OAuthButtons";
import { Eye, EyeOff, Lock, UserPlus } from "lucide-react";
import { BetaBadge, BetaShell } from "./BetaShell";
import { safeCallbackPath } from "@/lib/safeCallback";

/**
 * Inscription par lien d'invitation (/register?invite=…) : l'adresse invitée est
 * pré-remplie et verrouillée (le serveur la revérifie, src/app/api/auth/register).
 *
 * Variante invitation de FOYER (/register?groupInvite=…, src/lib/groupInviteSignup.ts) :
 * adresse verrouillée si le lien est nominatif, libre sinon ; après l'inscription, retour sur
 * la page du groupe (/groups/join/<jeton>) où la personne rejoint par le flux habituel.
 */
export function RegisterForm({
  inviteToken,
  groupInviteToken,
  groupName,
  inviteEmail,
}: {
  inviteToken?: string;
  groupInviteToken?: string;
  groupName?: string;
  inviteEmail: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail ?? "");
  const locked = inviteEmail !== null;
  // Page du groupe : chemin interne construit ici, jamais une adresse reçue de l'extérieur.
  const backTo = groupInviteToken ? safeCallbackPath(`/groups/join/${groupInviteToken}`) : "/";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (!consent) {
      setError("Tu dois accepter la politique de confidentialité pour créer un compte.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, consent, invite: inviteToken, groupInvite: groupInviteToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    // Connexion automatique après inscription
    await signIn("credentials", { email, password, redirect: false });
    router.push(backTo);
    router.refresh();
  };

  const field = "h-11 text-base sm:text-sm";

  return (
    <BetaShell className="max-w-lg">
      <div className="text-center">
        <BetaBadge>{groupInviteToken ? "Invitation de foyer" : "Invitation à la bêta privée"}</BetaBadge>
        <h1
          className="beta-rise mt-5 text-balance text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl"
          style={{ ["--d" as string]: "60ms" }}
        >
          {groupInviteToken ? (
            <>
              Crée ton compte pour rejoindre <span className="beta-mark">{groupName}</span>
            </>
          ) : (
            <>
              Tu es invité·e à rejoindre <span className="beta-mark">MindDump</span>
            </>
          )}
        </h1>
        <p
          className="beta-rise mx-auto mt-3 max-w-sm text-pretty text-muted-foreground"
          style={{ ["--d" as string]: "140ms" }}
        >
          {groupInviteToken
            ? "Une fois ton compte créé, tu reviens sur la page du groupe pour le rejoindre."
            : "Crée ton compte pour retrouver tâches, courses, menus et agenda de ton foyer au même endroit."}
        </p>
      </div>

      <div
        className="beta-rise mt-7 space-y-6 rounded-3xl border border-border bg-card p-6 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_-12px_hsl(var(--foreground)/0.18)] sm:p-8"
        style={{ ["--d" as string]: "200ms" }}
      >
          {/* Un compte créé via Google ou Apple passe ensuite par /consentement. */}
          <OAuthButtons
            callbackUrl={backTo}
            label="S'inscrire avec"
            beforeStart={async () => {
              // Le jeton passe dans un cookie httpOnly (pas dans l'URL du fournisseur).
              const res = await fetch("/api/signup-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(groupInviteToken ? { groupInvite: groupInviteToken } : { invite: inviteToken }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Ce lien d'invitation n'est plus valable.");
              }
            }}
            webOnlyHint="Pour t'inscrire avec Google ou Apple, ouvre ce lien dans le navigateur de ton téléphone ou de ton ordinateur. Dans l'app, tu peux créer ton compte avec un mot de passe ci-dessous, ou te connecter avec Google ou Apple une fois ton compte créé."
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Prénom</Label>
              <Input
                id="name"
                type="text"
                placeholder="Alex"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="given-name"
                className={field}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="prenom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={locked}
                aria-describedby={locked ? "email-locked" : undefined}
                required
                autoComplete="email"
                className={locked ? `${field} bg-muted text-muted-foreground` : field}
              />
              {locked && (
                <p id="email-locked" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Ton invitation est liée à cette adresse.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="8 caractères minimum"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`${field} pr-12`}
                />
                <button aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className={field}
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-muted/60 px-3 py-2">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="relative mt-3 h-5 w-5 rounded-md after:absolute after:-inset-3"
                aria-required="true"
              />
              <Label htmlFor="consent" className="py-2 text-sm font-normal leading-snug text-muted-foreground">
                J&apos;accepte la{" "}
                <Link
                  href="/confidentialite"
                  target="_blank"
                  className="text-foreground font-semibold underline underline-offset-2"
                >
                  politique de confidentialité
                </Link>{" "}
                et le traitement de mes données pour le fonctionnement de MindDump.
              </Label>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button type="submit" className="h-12 w-full text-base" size="lg" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Création…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Créer mon compte
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link href={groupInviteToken ? `/login?callbackUrl=${encodeURIComponent(backTo)}` : "/login"} className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-2">
              Se connecter
            </Link>
          </p>
      </div>
    </BetaShell>
  );
}
