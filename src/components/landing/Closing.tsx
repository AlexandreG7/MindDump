import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GUIDES } from "@/lib/content/guides";
import { LogoMark } from "./Header";

export function Closing() {
  return (
    <section className="py-16 md:py-28" aria-labelledby="lp2-cta-h">
      <div className="lp2-shell">
        <div className="lp2-cta" data-reveal>
          <p className="lp2-eyebrow justify-center !text-[hsl(var(--ink))]">Prêt ?</p>
          <h2 id="lp2-cta-h" className="mx-auto mt-5 max-w-[14ch]">
            Arrête d&apos;être le seul cerveau du foyer.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[1.05rem] font-medium leading-relaxed" style={{ color: "hsl(var(--ink) / 0.82)" }}>
            Demande ton accès à la bêta, invite ta famille, et vide ta charge mentale une bonne fois.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="lp2-btn lp2-btn-ink !min-h-[3.6rem] !px-9 !text-[1.05rem]">
              Demander un accès
              <ArrowRight className="arrow h-5 w-5" aria-hidden="true" />
            </Link>
            <Link href="/login" className="lp2-btn lp2-btn-ghost !min-h-[3.6rem] !border-[hsl(var(--ink)/0.4)]">
              Se connecter
            </Link>
          </div>
        </div>

        {/* Maillage interne : sans ces liens, les guides ne sont atteignables
            que par le sitemap. */}
        <footer className="lp2-foot mt-14 flex flex-col items-center gap-6">
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3" aria-label="Guides et informations">
            {GUIDES.map((g) => (
              <Link key={g.slug} href={`/${g.slug}`}>
                {g.navLabel}
              </Link>
            ))}
            <Link href="/docs">Documentation</Link>
            <Link href="/confidentialite">Confidentialité</Link>
            <Link href="/cgu">CGU</Link>
          </nav>
          <p className="flex items-center gap-2 text-sm text-[hsl(var(--mute))]">
            <LogoMark size={20} /> MindDump, vide ta charge mentale.
          </p>
        </footer>
      </div>
    </section>
  );
}
