import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { resolveUploadPaths } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

// Sert les fichiers envoyés après le build (atteint via la rewrite /uploads/*).
export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const url = `/uploads/${params.path.join("/")}`;
  const contentType = CONTENT_TYPES[path.extname(url).toLowerCase()];
  if (!contentType) {
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  }

  for (const filePath of resolveUploadPaths(url)) {
    try {
      const data = await readFile(filePath);
      return new NextResponse(data, {
        headers: {
          "Content-Type": contentType,
          // Noms de fichiers aléatoires : un nouvel upload = une nouvelle URL.
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Essayer le dossier suivant
    }
  }

  return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
}
