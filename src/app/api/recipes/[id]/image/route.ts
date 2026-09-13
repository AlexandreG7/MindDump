import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { writeFile, mkdir, unlink } from "fs/promises";
import { randomBytes } from "crypto";
import path from "path";
import { UPLOAD_DIR, resolveUploadPaths } from "@/lib/uploads";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 Mo

// Détecte le type réel à partir des magic bytes (ne pas se fier à l'extension
// ou au nom de fichier fournis par le client).
function detectImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "webp";
  return null;
}

async function deleteUpload(url: string) {
  for (const filePath of resolveUploadPaths(url)) {
    await unlink(filePath).catch(() => {});
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // 1. Vérifier la propriété de la recette AVANT toute écriture disque.
  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, image: true },
  });
  if (!recipe) {
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("image") as File;
  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (buffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 8 Mo)" }, { status: 400 });
  }

  // 2. Valider le type réel via les magic bytes (pas l'extension fournie).
  const ext = detectImageExt(buffer);
  if (!ext) {
    return NextResponse.json({ error: "Format non supporté" }, { status: 400 });
  }

  // 3. Nom de fichier aléatoire (jamais dérivé d'une entrée client → pas de
  //    traversée de chemin).
  const filename = `${recipe.id}-${randomBytes(8).toString("hex")}.${ext}`;
  const uploadDir = path.join(UPLOAD_DIR, "recipes");
  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
  } catch (err) {
    console.error("[recipe image] écriture impossible dans", uploadDir, err);
    return NextResponse.json({ error: "Impossible d'enregistrer l'image" }, { status: 500 });
  }

  // Delete old image if exists
  if (recipe.image) await deleteUpload(recipe.image);

  const imageUrl = `/uploads/recipes/${filename}`;
  await prisma.recipe.update({
    where: { id: recipe.id },
    data: { image: imageUrl },
  });

  return NextResponse.json({ image: imageUrl });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: user.id },
    select: { image: true },
  });

  if (recipe?.image) await deleteUpload(recipe.image);

  await prisma.recipe.updateMany({
    where: { id: params.id, userId: user.id },
    data: { image: null },
  });

  return NextResponse.json({ success: true });
}
