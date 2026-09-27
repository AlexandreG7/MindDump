import { ImageResponse } from "next/og";

/**
 * Icône de l'app en PNG, même dessin que src/app/icon.svg. Sert à l'écran
 * d'accueil iOS (apple-icon.tsx) et au manifest PWA (icons/[name]/route.tsx).
 *
 * - "full" : fond plein jusqu'aux bords. iOS arrondit lui-même les coins, et
 *   Android découpe la forme qu'il veut dans une icône "maskable" : le « M »
 *   reste dans la zone sûre (cercle de 80 % du côté).
 * - "rounded" : coins arrondis comme icon.svg, pour les contextes qui affichent
 *   l'icône telle quelle (icône "any" du manifest).
 */
export const APP_ICON_COLOR = "#F97316";

export function renderAppIcon(size: number, shape: "full" | "rounded") {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: APP_ICON_COLOR,
          borderRadius: shape === "rounded" ? size / 4 : 0,
        }}
      >
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M9 23V10l7 8 7-8v13"
            fill="none"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
