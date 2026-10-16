import Link from "next/link";
import { cn } from "@/lib/utils";

/** Fond + en-tête communs des pages d'accès à la bêta (demande, inscription, lien invalide). */
export function BetaShell({
  children,
  className,
  loginLink = true,
}: {
  children: React.ReactNode;
  className?: string;
  loginLink?: boolean;
}) {
  return (
    <div className="beta-page fixed inset-0 z-40 overflow-y-auto bg-background text-foreground">
      <div className="beta-mesh" aria-hidden="true">
        <span className="beta-blob beta-blob-a" />
        <span className="beta-blob beta-blob-b" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-4 sm:px-8">
        <Link
          href="/"
          className="-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 text-lg font-extrabold tracking-tight focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          MindDump
        </Link>
        {loginLink && (
          <Link
            href="/login"
            className="-mx-3 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Se connecter
          </Link>
        )}
      </header>

      <main className={cn("mx-auto w-full max-w-5xl px-5 pb-12 pt-6 sm:px-8 sm:pt-10", className)}>{children}</main>
    </div>
  );
}

export function BetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <p className="beta-rise inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      {children}
    </p>
  );
}
