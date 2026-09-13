import { prisma } from "./prisma";

// Recette exposée via un lien de partage : uniquement le contenu, jamais
// les champs liés au propriétaire (userId, groupe, planning...).
export function findSharedRecipe(token: string) {
  return prisma.recipe.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      description: true,
      servings: true,
      prepTime: true,
      cookTime: true,
      steps: true,
      image: true,
      ingredients: {
        select: { id: true, name: true, quantity: true, unit: true },
      },
    },
  });
}
