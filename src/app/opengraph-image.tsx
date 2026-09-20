import { ImageResponse } from "next/og";
import { siteDescription, siteName } from "@/lib/site";

// Généré au build en PNG statique : aucune police externe n'est chargée ici,
// next/og utilise sa police par défaut.
export const alt = `${siteName} — vide ta charge mentale`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #1C2333 0%, #2A1810 100%)",
          color: "#F8F7F5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "#F97316",
            }}
          />
          <div style={{ fontSize: "36px", fontWeight: 700 }}>{siteName}</div>
        </div>

        <div style={{ fontSize: "76px", fontWeight: 700, marginTop: "40px" }}>
          Vide ta charge mentale.
        </div>

        <div
          style={{
            fontSize: "32px",
            marginTop: "28px",
            lineHeight: 1.4,
            color: "#C7CAD1",
          }}
        >
          {siteDescription}
        </div>
      </div>
    ),
    size,
  );
}
