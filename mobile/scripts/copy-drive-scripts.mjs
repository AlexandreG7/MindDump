// Copie les scripts de l'extension Match dans www/drive/ avant chaque
// `cap copy` / `cap sync` (hook capacitor:copy:before de package.json) :
// l'écran Match de l'app les injecte tels quels (étape 3.6).
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const mobile = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(mobile, "..", "drive-extension");
const target = join(mobile, "www", "drive");
mkdirSync(target, { recursive: true });
for (const file of ["page.js", "content.js"]) copyFileSync(join(source, file), join(target, file));
