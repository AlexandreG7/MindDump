import path from "path";

// Dossier où sont écrits les fichiers envoyés par les utilisateurs.
// En production (Docker), il pointe vers un volume persistant (UPLOAD_DIR) :
// le dossier public/ de l'image appartient à root et est recréé à chaque
// déploiement, et Next.js ne sert pas les fichiers ajoutés à public/ après le build.
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

// Anciens fichiers livrés avec le dépôt (public/uploads).
const LEGACY_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Convertit une URL publique "/uploads/recipes/x.jpg" en chemins disque
// candidats, en refusant toute traversée de dossier.
export function resolveUploadPaths(url: string): string[] {
  if (!url.startsWith("/uploads/")) return [];
  const relative = url.slice("/uploads/".length);
  return [UPLOAD_DIR, LEGACY_UPLOAD_DIR]
    .map((dir) => {
      const resolved = path.resolve(dir, relative);
      return resolved.startsWith(dir + path.sep) ? resolved : null;
    })
    .filter((p): p is string => p !== null);
}
