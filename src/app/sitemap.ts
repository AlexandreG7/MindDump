import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/content/guides";
import { siteUrl } from "@/lib/site";

/**
 * Uniquement les pages publiques indexables. Toute page ajoutée ici doit aussi
 * être autorisée dans robots.ts, sinon Google la découvre sans pouvoir la lire.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...GUIDES.map((guide) => ({
      url: `${siteUrl}/${guide.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${siteUrl}/docs`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/confidentialite`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
