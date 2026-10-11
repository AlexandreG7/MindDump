import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#F97316" />
      <path
        d="M9 23V10l7 8 7-8v13"
        fill="none"
        stroke="#14181F"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV = [
  { href: "#boucle", label: "La boucle" },
  { href: "#assistant", label: "Assistant IA" },
  { href: "#foyer", label: "Le foyer" },
  { href: "#quotidien", label: "Au quotidien" },
];

export function Header() {
  return (
    <header className="lp2-header" data-scrolled="false" data-lp-header>
      <div className="lp2-shell flex h-16 items-center justify-between gap-2 sm:gap-4 !px-4 sm:!px-5 md:!px-10">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-[1.05rem] sm:text-[1.15rem] tracking-tight" aria-label="MindDump, accueil">
          <LogoMark size={28} />
          MindDump
        </Link>
        <nav className="lp2-nav hidden md:flex items-center gap-7" aria-label="Sections de la page">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} data-lp-anchor>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-0.5 sm:gap-2">
          <Link href="/login" className="lp2-btn lp2-btn-ghost !min-h-10 !px-2.5 sm:!px-4 !text-sm !border-transparent sm:!border-[hsl(var(--ink)/0.18)]">
            Se connecter
          </Link>
          <Link href="/register" className="lp2-btn lp2-btn-or !min-h-10 !px-3 sm:!px-4 !text-sm">
            <span className="hidden sm:inline">Créer mon espace</span>
            <span className="sm:hidden">Essayer</span>
            <ArrowRight className="arrow h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
