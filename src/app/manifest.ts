import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "@/lib/site";
import { THEME_COLORS } from "@/lib/theme";

// Menu Partager (Android, Chrome) : un lien de recette est importé, le reste
// peut devenir une tâche (src/app/partager). Forme de la spécification Web
// Share Target ; le type de Next 14 décrit à tort `params` comme un tableau.
const SHARE_TARGET = {
  action: "/partager",
  method: "GET",
  params: { title: "title", text: "text", url: "url" },
} as unknown as MetadataRoute.Manifest["share_target"];

// Manifest PWA : rend l'app installable (« Ajouter à l'écran d'accueil ») et
// l'ouvre en plein écran, sans la barre du navigateur. Voir docs/app-mobile.md.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteName,
    short_name: siteName,
    description: siteDescription,
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_COLORS.background,
    theme_color: THEME_COLORS.light,
    categories: ["productivity", "lifestyle"],
    share_target: SHARE_TARGET,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
