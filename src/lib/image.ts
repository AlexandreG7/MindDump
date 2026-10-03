/**
 * Réduit une photo (maxSide px de côté au plus) et la réencode en JPEG : envoi
 * plus léger, et les formats que l'API ne lit pas (HEIC d'iPhone sous Safari)
 * sont convertis au passage.
 */
export async function prepareImage(file: Blob, maxSide = 2000, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable"));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("unreadable");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("unreadable"))), "image/jpeg", quality)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

const RECIPE_PHOTO_SIDE = 1600;

/**
 * Photo de recette prête à l'envoi : une photo d'appareil (souvent 3 à 6 Mo)
 * tombe à quelques centaines de Ko, ce qui accélère l'envoi et chaque
 * affichage. Si la conversion échoue ou n'allège rien, on garde l'original.
 */
export async function prepareRecipePhoto(file: File): Promise<Blob> {
  const prepared = await prepareImage(file, RECIPE_PHOTO_SIDE).catch(() => null);
  return prepared && prepared.size < file.size ? prepared : file;
}

/**
 * Version réduite d'une image distante pour les vignettes, quand l'hébergeur
 * sait la redimensionner (HelloFresh : paramètre w_ de l'URL, 1200 px à
 * l'import). Les autres URL sont rendues telles quelles.
 */
export function thumbnailUrl(src: string, width: number): string {
  if (src.startsWith("https://img.hellofresh.com/")) {
    return src.replace(/([/,])w_\d+(?=[,/])/, `$1w_${width}`);
  }
  return src;
}
