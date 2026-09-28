/**
 * Génère l'icône et l'écran de lancement natifs depuis le dessin de l'icône du
 * site (src/lib/appIcon.tsx), pour qu'ils restent identiques.
 * Depuis la racine du dépôt : npx tsx mobile/scripts/generate-assets.tsx
 */
import { execFileSync } from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import React from "react";
import { ImageResponse } from "next/og";

// Le JSX du site est compilé en React.createElement (tsconfig « preserve ») :
// hors de Next, React doit être global avant d'importer appIcon.tsx.
Object.assign(globalThis, { React });

const IOS_ASSETS = "mobile/ios/App/App/Assets.xcassets";
const SPLASH_BACKGROUND = "#F8F7F5";
const SPLASH_SIZE = 2732;
const LOGO = 360;

async function save(response: Response, path: string) {
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  // L'App Store refuse une icône avec canal alpha : aller-retour par JPEG
  // (sips, fourni avec macOS) pour le retirer.
  const jpeg = `${path}.jpg`;
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "100", path, "--out", jpeg], { stdio: "ignore" });
  execFileSync("sips", ["-s", "format", "png", jpeg, "--out", path], { stdio: "ignore" });
  unlinkSync(jpeg);
  console.log("écrit", path);
}

function splash(APP_ICON_COLOR: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: SPLASH_BACKGROUND,
        }}
      >
        <div
          style={{
            width: LOGO,
            height: LOGO,
            display: "flex",
            borderRadius: LOGO / 4,
            background: APP_ICON_COLOR,
          }}
        >
          <svg width={LOGO} height={LOGO} viewBox="0 0 32 32">
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
      </div>
    ),
    { width: SPLASH_SIZE, height: SPLASH_SIZE }
  );
}

async function main() {
  const { APP_ICON_COLOR, renderAppIcon } = await import("../../src/lib/appIcon");
  // iOS : 1024 px, fond plein, sans transparence (iOS arrondit les coins).
  await save(renderAppIcon(1024, "full"), `${IOS_ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`);
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    await save(splash(APP_ICON_COLOR), `${IOS_ASSETS}/Splash.imageset/${name}`);
  }
}

main();
