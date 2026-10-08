import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Seules les pages publiques et sans donnée personnelle sont ouvertes au
 * crawl : la landing et la documentation. Le reste est soit derrière
 * l'authentification, soit accessible par un lien à jeton qui ne doit jamais
 * se retrouver dans un index.
 *
 * Combinaison retenue pour ces pages : Disallow ici ET `noindex` dans leurs
 * métadonnées. Le Disallow empêche d'abord le crawl (aucune URL à jeton n'est
 * visitée, aucun doublon signalé) ; le noindex n'est qu'une ceinture si une URL
 * fuite via un lien externe. Limite connue : Google ne lit pas un noindex sur
 * une page bloquée. Pour retirer une URL déjà indexée, il faut donc lever le
 * Disallow le temps qu'elle disparaisse, ou utiliser l'outil de suppression.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/register",
          "/mot-de-passe-oublie",
          "/reinitialiser-mot-de-passe",
          "/profile",
          "/todos",
          "/calendar",
          "/lists",
          "/recipes",
          "/kids",
          "/groups",
          "/admin",
          "/confidentialite",
          "/consentement",
          "/shared/",
          "/wall/",
          "/partager",
          "/importer",
          "/auth/",
          "/hors-ligne",
          "/uploads/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
