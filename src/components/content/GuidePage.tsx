import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { GUIDES, type Guide } from "@/lib/content/guides";
import { siteUrl } from "@/lib/site";

/**
 * Gabarit des pages de contenu public.
 *
 * Composant serveur volontairement : ces pages n'ont aucune interaction, et
 * ce qu'un robot d'indexation lit doit être dans le HTML, pas produit par du
 * JavaScript. « lp-root » reprend le cadre de la landing, qui reste en thème
 * clair même quand l'app est en sombre.
 */
export function GuidePage({ guide }: { guide: Guide }) {
  const related = guide.related
    .map((slug) => GUIDES.find((g) => g.slug === slug))
    .filter((g): g is Guide => Boolean(g));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: guide.title,
          item: `${siteUrl}/${guide.slug}`,
        },
      ],
    },
  ];

  return (
    <div className="lp-root">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-border">
        <div className="lp-shell flex items-center justify-between h-16">
          <Link href="/" className="font-bold text-lg tracking-tight">
            MindDump
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm font-medium px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap hover:bg-secondary transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/register"
              className="hidden sm:block text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <article className="lp-shell py-14 md:py-20 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Accueil
        </Link>

        <p className="lp-eyebrow mt-8">{guide.eyebrow}</p>
        <h1 className="lp-title mt-2">{guide.title}</h1>
        <p className="text-lg text-muted-foreground mt-5 leading-relaxed">{guide.intro}</p>

        {guide.sections.map((section) => (
          <section key={section.heading} className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>

            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground mt-4 leading-relaxed">
                {paragraph}
              </p>
            ))}

            {section.bullets && (
              <div className="grid sm:grid-cols-2 gap-4 mt-8">
                {section.bullets.map((bullet) => (
                  <div key={bullet.title} className="lp-card p-5">
                    <h3 className="font-semibold">{bullet.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {bullet.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight">Questions fréquentes</h2>
          <dl className="mt-6 divide-y divide-border border-y border-border">
            {guide.faq.map((item) => (
              <div key={item.question} className="py-5">
                <dt className="font-semibold">{item.question}</dt>
                <dd className="text-muted-foreground mt-2 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 px-6 py-12 sm:px-10 sm:py-14 text-center">
          <h2 className="text-white font-bold tracking-tight text-[clamp(1.6rem,3.6vw,2.3rem)] leading-tight">
            Arrête d&apos;être le seul cerveau du foyer.
          </h2>
          <p className="text-white/90 mt-4 max-w-lg mx-auto">
            Crée ton espace, invite ta famille, et vide ta charge mentale une bonne fois.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link
              href="/register"
              className="rounded-xl bg-white text-[hsl(24_85%_45%)] font-semibold px-7 py-3.5 hover:bg-white/90 transition-colors"
            >
              Créer un compte
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-white/40 text-white font-semibold px-7 py-3.5 hover:bg-white/10 transition-colors"
            >
              Découvrir MindDump
            </Link>
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">À lire ensuite</h2>
            <div className="mt-6 space-y-3">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/${item.slug}`}
                  className="lp-card p-5 flex items-start justify-between gap-4 group"
                >
                  <span>
                    <span className="font-semibold block">{item.title}</span>
                    <span className="text-sm text-muted-foreground mt-1 block leading-relaxed">
                      {item.metaDescription}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <footer className="border-t border-border py-10">
        <div className="lp-shell flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Accueil
          </Link>
          {GUIDES.map((item) => (
            <Link
              key={item.slug}
              href={`/${item.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {item.navLabel}
            </Link>
          ))}
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Documentation
          </Link>
        </div>
      </footer>
    </div>
  );
}
