import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const formData = await req.formData();
  const file = formData.get("image") as File;
  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const allowed = ["jpg", "jpeg", "png", "webp", "gif"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Format non supporté" }, { status: 400 });
  }

  const filename = `${params.id}-${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "recipes");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  // Delete old image if exists
  const existing = await prisma.recipe.findFirst({
    where: { id: params.id, userId: user.id },
    select: { image: true },
  });
  if (existing?.image) {
    const oldPath = path.join(process.cwd(), "public", existing.image);
    if (existsSync(oldPath)) {
      await unlink(oldPath).catch(() => {});
    }
  }

  const imageUrl = `/uploads/recipes/${filename}`;
  await prisma.recipe.updateMany({
    where: { id: params.id, userId: user.id },
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

  if (recipe?.image) {
    const filePath = path.join(process.cwd(), "public", recipe.image);
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => {});
    }
  }

  await prisma.recipe.updateMany({
    where: { id: params.id, userId: user.id },
    data: { image: null },
  });

  return NextResponse.json({ success: true });
}
