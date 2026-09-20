import type { Metadata } from "next";
import { GuidePage } from "@/components/content/GuidePage";
import { getGuide } from "@/lib/content/guides";

// Contenu et métadonnées viennent de la même source : lib/content/guides.ts.
const guide = getGuide("calendrier-familial-partage");

export const metadata: Metadata = {
  title: guide.metaTitle,
  description: guide.metaDescription,
  alternates: { canonical: `/${guide.slug}` },
  openGraph: {
    type: "article",
    url: `/${guide.slug}`,
    title: guide.metaTitle,
    description: guide.metaDescription,
  },
};

export default function Page() {
  return <GuidePage guide={guide} />;
}
