import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSharedRecipe } from "@/lib/sharedRecipe";
import { SharedRecipe } from "./SharedRecipe";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const recipe = await findSharedRecipe(params.token);
  if (!recipe) return { title: "Recette introuvable - MindDump" };
  return {
    ...(process.env.NEXTAUTH_URL && { metadataBase: new URL(process.env.NEXTAUTH_URL) }),
    title: `${recipe.title} - MindDump`,
    description: recipe.description || "Une recette partagée avec toi sur MindDump",
    // Aperçu dans les messageries (WhatsApp, iMessage...)
    openGraph: {
      title: recipe.title,
      description: recipe.description || "Une recette partagée avec toi sur MindDump",
      ...(recipe.image && { images: [recipe.image] }),
    },
    robots: { index: false },
  };
}

export default async function SharedRecipePage({
  params,
}: {
  params: { token: string };
}) {
  const recipe = await findSharedRecipe(params.token);
  if (!recipe) notFound();

  const { id: _id, ...data } = recipe;
  return <SharedRecipe token={params.token} recipe={data} />;
}
