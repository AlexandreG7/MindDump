import { renderAppIcon } from "@/lib/appIcon";

// iOS n'accepte pas le SVG pour l'écran d'accueil : même dessin que icon.svg,
// rendu en PNG au build. Fond plein (iOS arrondit lui-même les coins).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(size.width, "full");
}
