"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, CheckSquare, ChefHat, Mail, Send } from "lucide-react";
import { BetaBadge, BetaShell } from "./BetaShell";

const MESSAGE_MAX = 500;

/** Demande d'accès à la bêta privée : la réponse est la même dans tous les cas. */
export function RequestAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);

  // Après l'envoi, le focus passe au message de confirmation (lecteurs d'écran, clavier).
  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!consent) {
      setError("Tu dois accepter la politique de confidentialité pour envoyer ta demande.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/beta-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }
      setSent(true);
    } catch {
      setError("Impossible d'envoyer la demande. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: CheckSquare, text: "Tâches et courses partagées avec tout le foyer" },
    { icon: ChefHat, text: "Menus de la semaine et recettes au même endroit" },
    { icon: CalendarDays, text: "Un agenda familial que tout le monde voit" },
  ];
  const field = "h-11 text-base sm:text-sm";

  return (
    <BetaShell>
      <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pt-6">
        <section aria-labelledby="beta-title" className={sent ? "hidden lg:block" : undefined}>
          <BetaBadge>Bêta privée · accès sur invitation</BetaBadge>
          <h1
            id="beta-title"
            className="beta-rise mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ ["--d" as string]: "60ms" }}
          >
            Vide ta <span className="beta-mark">charge mentale</span>, en famille.
          </h1>
          <p
            className="beta-rise mt-4 max-w-md text-pretty text-base text-muted-foreground sm:text-lg"
            style={{ ["--d" as string]: "140ms" }}
          >
            MindDump ouvre ses portes au compte-gouttes. Dis-nous qui tu es, on te répond avec ton lien d&apos;inscription.
          </p>
          <ul className="mt-6 space-y-3">
            {benefits.map(({ icon: Icon, text }, i) => (
              <li
                key={text}
                className="beta-rise flex items-center gap-3 text-[0.95rem] font-medium"
                style={{ ["--d" as string]: `${220 + i * 80}ms` }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <div
          className="beta-rise rounded-3xl border border-border bg-card p-6 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_-12px_hsl(var(--foreground)/0.18)] sm:p-8"
          style={{ ["--d" as string]: "180ms" }}
        >
          {sent ? (
            <div role="status" className="space-y-5 py-2 text-center">
              <span className="beta-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
                <svg viewBox="0 0 24 24" className="beta-tick h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <div className="space-y-2">
                <h2 ref={successRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight outline-none">
                  Merci{name.trim() ? `, ${name.trim()}` : ""}, on revient vers toi
                </h2>
                <p className="text-pretty text-sm text-muted-foreground">
                  Si ta demande est acceptée, tu recevras un lien d&apos;inscription personnel à l&apos;adresse que tu as indiquée.
                </p>
              </div>
              <p className="mx-auto flex max-w-xs items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-left text-xs text-muted-foreground">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Pense à regarder tes courriers indésirables si rien n&apos;arrive.
              </p>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Retour à l&apos;accueil
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Se connecter
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Demander un accès</h2>
                <p className="mt-1 text-sm text-muted-foreground">Une minute, et on s&apos;occupe du reste.</p>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Prénom</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Alex"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                    autoComplete="given-name"
                    className={field}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="prenom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={field}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Un mot sur ton envie d&apos;essayer (facultatif)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={MESSAGE_MAX}
                    rows={3}
                    className="text-base sm:text-sm"
                  />
                  <p className="text-right text-xs tabular-nums text-muted-foreground">
                    {message.length} / {MESSAGE_MAX}
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-muted/60 px-3 py-2">
                  <Checkbox
                    id="consent"
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v === true)}
                    className="mt-3 h-5 w-5 rounded-md after:absolute after:-inset-3 relative"
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
                    et que MindDump conserve ma demande pour y répondre.
                  </Label>
                </div>

                {error && (
                  <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="h-12 w-full text-base" size="lg" disabled={loading}>
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {loading ? "Envoi…" : "Envoyer ma demande"}
                  </span>
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-2">
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </BetaShell>
  );
}
