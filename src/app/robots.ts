import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Seules les pages publiques et sans donnée personnelle sont ouvertes au
 * crawl : la landing et la documentation. Le reste est soit derrière
 * l'authentification, soit accessible par un lien à jeton qui ne doit jamais
 * se retrouver dans un index.
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
          "/profile",
          "/todos",
          "/calendar",
          "/lists",
          "/recipes",
          "/kids",
          "/groups",
          "/shared/",
          "/uploads/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
