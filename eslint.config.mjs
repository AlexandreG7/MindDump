// ESLint 9 (configuration « flat ») : remplace .eslintrc.json et « next lint »,
// supprimé dans Next 16. Mêmes règles qu'avant (next/core-web-vitals).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // eslint-plugin-react-hooks 7 (apporté par eslint-config-next 16) ajoute les
    // règles du React Compiler, que MindDump n'utilise pas. Celles qui signalent du
    // code existant passent en avertissement : visibles, sans bloquer le lint. Les
    // règles d'avant (rules-of-hooks en erreur, exhaustive-deps en avertissement)
    // et les autres règles du compilateur gardent leur niveau.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker généré au build (next.config.mjs).
    "public/sw.js",
    "public/swe-worker-*.js",
    // Sous-projets avec leur propre outillage.
    "minddump-mcp/**",
    "mobile/**",
    "drive-extension/**",
    "hellofresh-proxy/**",
  ]),
]);
