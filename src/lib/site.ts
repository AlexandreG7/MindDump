/**
 * Identité publique du site, utilisée partout où le SEO a besoin d'URLs
 * absolues : metadataBase, canonical, Open Graph, robots.txt, sitemap.xml.
 *
 * robots.txt et sitemap.xml sont générés au moment du build, où l'image Docker
 * ne reçoit pas NEXTAUTH_URL (.env est dans .dockerignore) : la valeur par
 * défaut doit donc être l'URL de production. NEXTAUTH_URL ne sert que de
 * secours, et jamais quand elle pointe sur une machine locale — sinon un build
 * lancé depuis un poste de dev publierait un sitemap en localhost.
 */
const PRODUCTION_URL = "https://minddump.fr";

function resolveSiteUrl(): string {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
  if (!candidate) return PRODUCTION_URL;

  try {
    const { hostname } = new URL(candidate);
    if (hostname === "localhost" || hostname === "127.0.0.1") return PRODUCTION_URL;
  } catch {
    return PRODUCTION_URL;
  }

  return candidate.replace(/\/+$/, "");
}

export const siteUrl = resolveSiteUrl();

export const siteName = "MindDump";

export const siteTitle =
  "MindDump — l'organisation familiale : tâches, repas, courses et calendrier";

export const siteDescription =
  "Les tâches, le calendrier partagé, les listes de courses et les menus de la semaine de toute la famille au même endroit — avec un assistant IA qui les remplit à ta place.";
