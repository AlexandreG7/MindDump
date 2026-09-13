import { readFile, stat } from "fs/promises";
import { homedir } from "os";
import path from "path";
import { config } from "./config.js";
import { client } from "./client.js";

/**
 * Chargement d'une photo depuis une URL, du base64 ou un fichier local,
 * puis envoi vers MindDump (POST /api/recipes/:id/image).
 * Le type réel de l'image est vérifié côté API (magic bytes).
 */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // même limite que l'API
const FETCH_TIMEOUT_MS = 20_000;

export interface ImageSource {
  imageUrl?: string;
  imageBase64?: string;
  imagePath?: string;
}

export function hasImageSource(src: ImageSource): boolean {
  return Boolean(src.imageUrl || src.imageBase64 || src.imagePath);
}

function checkSize(size: number) {
  if (size === 0) throw new Error("Image vide");
  if (size > MAX_IMAGE_BYTES) throw new Error("Image trop volumineuse (max 8 Mo)");
}

async function fromUrl(raw: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`URL d'image invalide : ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Seules les URL http(s) sont acceptées");
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "MindDump-MCP/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Téléchargement de l'image impossible (${response.status})`);
  }
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared) checkSize(declared);

  const buffer = Buffer.from(await response.arrayBuffer());
  checkSize(buffer.length);
  return buffer;
}

function fromBase64(raw: string): Buffer {
  // Accepte aussi une data URI : "data:image/jpeg;base64,...."
  const data = raw.replace(/^data:[^;,]+;base64,/, "").replace(/\s+/g, "");
  const buffer = Buffer.from(data, "base64");
  checkSize(buffer.length);
  return buffer;
}

async function fromPath(raw: string): Promise<Buffer> {
  // En mode SSE le serveur est distant : lire son disque n'a pas de sens
  // et exposerait ses fichiers.
  if (config.transport !== "stdio") {
    throw new Error("imagePath n'est disponible qu'en mode local (stdio). Utilise imageUrl ou imageBase64.");
  }
  const filePath = path.resolve(raw.replace(/^~(?=$|\/)/, homedir()));
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) throw new Error(`Fichier introuvable : ${filePath}`);
  checkSize(info.size);
  return readFile(filePath);
}

async function loadImage(src: ImageSource): Promise<Buffer> {
  const provided = [src.imageUrl, src.imageBase64, src.imagePath].filter(Boolean).length;
  if (provided === 0) throw new Error("Fournir imageUrl, imageBase64 ou imagePath");
  if (provided > 1) throw new Error("Fournir une seule source d'image (imageUrl, imageBase64 ou imagePath)");

  if (src.imageUrl) return fromUrl(src.imageUrl);
  if (src.imageBase64) return fromBase64(src.imageBase64);
  return fromPath(src.imagePath!);
}

/** Remplace la photo principale de la recette. Retourne l'URL de l'image. */
export async function uploadRecipeImage(recipeId: string, src: ImageSource): Promise<string> {
  const buffer = await loadImage(src);
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(buffer)]), "photo");
  const result = await client.upload<{ image: string }>(
    `/api/recipes/${encodeURIComponent(recipeId)}/image`,
    form
  );
  return result.image;
}
