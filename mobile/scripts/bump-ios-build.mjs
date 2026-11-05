// Incrémente le numéro de build iOS (CURRENT_PROJECT_VERSION) de l'app et de
// l'extension de partage avant chaque envoi TestFlight : App Store Connect
// refuse deux builds avec le même numéro (docs/app-mobile.md, 4.1).
//
//   npm run ios:bump            → build + 1
//   npm run ios:bump -- 2.0     → nouvelle version 2.0, build remis à 1
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "ios", "App", "App.xcodeproj", "project.pbxproj");
let pbx = readFileSync(file, "utf8");

const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => Number(m[1]));
if (builds.length === 0) throw new Error("CURRENT_PROJECT_VERSION introuvable");

const version = process.argv[2];
if (version && !/^\d+(\.\d+){0,2}$/.test(version)) throw new Error(`Version invalide : ${version}`);

const build = version ? 1 : Math.max(...builds) + 1;
pbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
if (version) pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
writeFileSync(file, pbx);

const current = pbx.match(/MARKETING_VERSION = ([^;]+);/)[1];
console.log(`iOS : version ${current}, build ${build}`);
