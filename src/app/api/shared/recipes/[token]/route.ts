import { NextRequest, NextResponse } from "next/server";
import { copyFile, mkdir } from "fs/promises";
import { randomBytes } from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { resolveGroupId } from "@/lib/groupAuth";
import { findSharedRecipe } from "@/lib/sharedRecipe";
import { UPLOAD_DIR, resolveUploadPaths } from "@/lib/uploads";

// Copie une image envoyée pour que la copie ne dépende pas du fichier de la
// recette d'origine (supprimé si son propriétaire change ou retire la photo).
async function duplicateImage(image: string | null, recipeId: string) {
  if (!image || !image.startsWith("/uploads/")) return image;
  const filename = `${recipeId}-${randomBytes(8).toString("hex")}${path.extname(image)}`;
  const dir = path.join(UPLOAD_DIR, "recipes");
  await mkdir(dir, { recursive: true });
  for (const source of resolveUploadPaths(image)) {
    try {
      await copyFile(source, path.join(dir, filename));
      return `/uploads/recipes/${filename}`;
    } catch {
      // Essayer le dossier suivant
    }
  }
  return null;
}

// Ajoute une recette partagée aux recettes de l'utilisateur connecté.
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const shared = await findSharedRecipe(params.token);
  if (!shared) {
    return NextResponse.json({ error: "Ce lien n'est plus valide" }, { status: 404 });
  }

  const groupId = await resolveGroupId(user.id, null);
  const copy = await prisma.recipe.create({
    data: {
      title: shared.title,
      description: shared.description,
      servings: shared.servings,
      prepTime: shared.prepTime,
      cookTime: shared.cookTime,
      steps: shared.steps,
      inCatalog: true,
      userId: user.id,
      groupId,
      ingredients: {
        create: shared.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      },
    },
  });

  const image = await duplicateImage(shared.image, copy.id).catch(() => null);
  if (image) {
    await prisma.recipe.update({ where: { id: copy.id }, data: { image } });
  }

  return NextResponse.json({ id: copy.id });
}
