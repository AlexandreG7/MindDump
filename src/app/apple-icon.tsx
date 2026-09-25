import { ImageResponse } from "next/og";

// iOS n'accepte pas le SVG pour l'écran d'accueil : même dessin que icon.svg,
// rendu en PNG au build. Fond plein (iOS arrondit lui-même les coins).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#F97316",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 32 32">
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
    size,
  );
}
