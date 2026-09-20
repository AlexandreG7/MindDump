import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { buildItemAccessWhere } from "@/lib/groupAuth";

// Crée (ou renvoie) le lien de partage public d'une recette.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, ...(await buildItemAccessWhere(user.id)) },
    select: { id: true, shareToken: true },
  });
  if (!recipe) {
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  }

  if (recipe.shareToken) {
    return NextResponse.json({ shareToken: recipe.shareToken });
  }

  // Jeton non devinable : c'est la seule protection du lien.
  const shareToken = randomBytes(18).toString("base64url");
  await prisma.recipe.update({
    where: { id: recipe.id },
    data: { shareToken },
  });

  return NextResponse.json({ shareToken });
}

// Désactive le lien : l'ancien lien renvoie ensuite une page introuvable.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.recipe.updateMany({
    where: { id: params.id, ...(await buildItemAccessWhere(user.id)) },
    data: { shareToken: null },
  });

  return NextResponse.json({ success: true });
}
