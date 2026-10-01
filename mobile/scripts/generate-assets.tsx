/**
 * Génère les icônes et écrans de lancement natifs (iOS et Android) depuis le
 * dessin de l'icône du site (src/lib/appIcon.tsx), pour qu'ils restent
 * identiques. Depuis la racine du dépôt :
 *   npx tsx mobile/scripts/generate-assets.tsx
 */
import { execFileSync } from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import React from "react";
import { ImageResponse } from "next/og";

// Le JSX du site est compilé en React.createElement (tsconfig « preserve ») :
// hors de Next, React doit être global avant d'importer appIcon.tsx.
Object.assign(globalThis, { React });

const IOS_ASSETS = "mobile/ios/App/App/Assets.xcassets";
const ANDROID_RES = "mobile/android/app/src/main/res";
const ICON_COLOR = "#F97316";
// --background du site, clair et sombre (couleur AppBackground côté iOS,
// app_background côté Android).
const SPLASH_BACKGROUND = "#F8F7F5";
const SPLASH_BACKGROUND_DARK = "#212226";

/** Le « M » blanc de l'icône, carré de `size` pixels. */
function Glyph({ size }: { size: number }) {
  return (
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
  );
}

/** Icône : carré orange (coins au choix) et « M » blanc. */
function icon(size: number, radius: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: ICON_COLOR, borderRadius: radius }}>
        <Glyph size={size} />
      </div>
    ),
    { width: size, height: size }
  );
}

/**
 * Premier plan d'une icône adaptative Android : « M » seul sur fond
 * transparent. Le système découpe ~72/108 du carré et ne garantit que le
 * cercle central de 66/108 : le glyphe (qui occupe 14/32 de son dessin) y tient.
 */
function adaptiveForeground(size: number) {
  const glyph = Math.round((size * 66) / 108);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Glyph size={glyph} />
      </div>
    ),
    { width: size, height: size }
  );
}

/** Écran de lancement : fond clair (ou sombre), icône arrondie au centre. */
function splash(width: number, height: number, background = SPLASH_BACKGROUND) {
  const logo = Math.round(Math.min(width, height) * 0.3);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
        }}
      >
        <div style={{ width: logo, height: logo, display: "flex", borderRadius: logo / 4, background: ICON_COLOR }}>
          <Glyph size={logo} />
        </div>
      </div>
    ),
    { width, height }
  );
}

async function save(response: Response, path: string, { opaque = false } = {}) {
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  if (opaque) {
    // L'App Store refuse une icône avec canal alpha : aller-retour par JPEG
    // (sips, fourni avec macOS) pour le retirer.
    const jpeg = `${path}.jpg`;
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "100", path, "--out", jpeg], { stdio: "ignore" });
    execFileSync("sips", ["-s", "format", "png", jpeg, "--out", path], { stdio: "ignore" });
    unlinkSync(jpeg);
  }
  console.log("écrit", path);
}

async function ios() {
  // 1024 px, fond plein, sans transparence (iOS arrondit lui-même les coins).
  await save(icon(1024, 0), `${IOS_ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`, { opaque: true });
  // Échelle unique, clair et sombre (Contents.json : apparence « dark »).
  await save(splash(2732, 2732), `${IOS_ASSETS}/Splash.imageset/splash-2732x2732.png`, { opaque: true });
  await save(splash(2732, 2732, SPLASH_BACKGROUND_DARK), `${IOS_ASSETS}/Splash.imageset/splash-2732x2732-dark.png`, {
    opaque: true,
  });
}

// Densités Android : taille de l'icône classique (48 dp) et du premier plan
// adaptatif (108 dp).
const DENSITIES: Record<string, number> = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// Écrans de lancement (Android < 12) : dimensions des fichiers de Capacitor.
const SPLASHES: Record<string, [number, number]> = {
  "drawable": [480, 320],
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
};

async function android() {
  for (const [density, scale] of Object.entries(DENSITIES)) {
    const dir = `${ANDROID_RES}/mipmap-${density}`;
    const legacy = Math.round(48 * scale);
    await save(icon(legacy, legacy / 4), `${dir}/ic_launcher.png`);
    await save(icon(legacy, legacy / 2), `${dir}/ic_launcher_round.png`);
    await save(adaptiveForeground(Math.round(108 * scale)), `${dir}/ic_launcher_foreground.png`);
  }
  for (const [dir, [width, height]] of Object.entries(SPLASHES)) {
    await save(splash(width, height), `${ANDROID_RES}/${dir}/splash.png`);
  }
}

async function main() {
  await ios();
  await android();
}

main();
