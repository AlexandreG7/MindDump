import { test } from "node:test";
import assert from "node:assert/strict";
import { recipeSource } from "./share";
import { parseHelloFreshPage, isHelloFreshRecipeUrl } from "./hellofresh";
import { parseJowRecipe, isJowUrl } from "./jow";
import { parseQuitoqueHtml, parseQuitoqueJsonLd, isQuitoqueRecipeUrl } from "./quitoque";

// ─── Classification des URL : recette / liste / accueil / autre site ───────
// Reflète la table de cas commentée dans
// mobile/ios/App/MindDumpShare/ShareViewController.swift — à tenir à jour
// ensemble.

const HF_ID = "6192a1f3a6b8c9001234abcd"; // 24 caractères hexadécimaux

test("recipeSource : HelloFresh", () => {
  assert.equal(
    recipeSource(`https://www.hellofresh.fr/recipes/poulet-roti-au-citron-${HF_ID}`),
    "hellofresh"
  );
  assert.equal(
    recipeSource(`https://www.hellofresh.co.uk/recipes/chicken-pie-${HF_ID}?servings=4`),
    "hellofresh"
  );
  // Page de liste.
  assert.equal(recipeSource("https://www.hellofresh.fr/recipes/"), null);
  assert.equal(recipeSource("https://www.hellofresh.fr/recipes"), null);
  // Collection sans identifiant de recette.
  assert.equal(recipeSource("https://www.hellofresh.fr/recipes/under-30-minutes"), null);
  // Accueil / autre page du site.
  assert.equal(recipeSource("https://www.hellofresh.fr/"), null);
  assert.equal(recipeSource("https://www.hellofresh.fr/menus"), null);
  // Domaine usurpé.
  assert.equal(recipeSource(`https://hellofresh.fr.evil.com/recipes/x-${HF_ID}`), null);
});

test("recipeSource : Jow", () => {
  assert.equal(recipeSource("https://jow.fr/recipes/crepes-maison-83jq25q5innb780q0wzk"), "jow");
  assert.equal(recipeSource("https://jow.fr/en/recipes/pancakes-83jq25q5innb780q0wzk"), "jow");
  // Un id court ou en majuscules reste une recette candidate : rien ne
  // garantit la longueur ou la casse de l'id Jow, c'est le contenu qui tranche.
  assert.equal(recipeSource("https://jow.fr/recipes/crepes-maison-ABC123"), "jow");
  assert.equal(recipeSource("https://jow.fr/recipes/crepes-maison"), "jow");
  // Liste nue : toujours refusée.
  assert.equal(recipeSource("https://jow.fr/recipes/"), null);
  assert.equal(recipeSource("https://jow.fr/recipes"), null);
  assert.equal(recipeSource("https://jow.fr/"), null);
});

test("recipeSource : Quitoque", () => {
  assert.equal(recipeSource("https://www.quitoque.fr/recettes/poulet-tikka-masala"), "quitoque");
  // Liste (pas de slug après /recettes).
  assert.equal(recipeSource("https://www.quitoque.fr/recettes"), null);
  assert.equal(recipeSource("https://www.quitoque.fr/recettes/"), null);
  // Collection, pas une recette précise.
  assert.equal(recipeSource("https://www.quitoque.fr/recettes/recettes-de-saison"), null);
  // Accueil / autre page.
  assert.equal(recipeSource("https://www.quitoque.fr/"), null);
  assert.equal(recipeSource("https://www.quitoque.fr/abonnement"), null);
});

test("recipeSource : autre site ou pas d'URL", () => {
  assert.equal(recipeSource("https://www.marmiton.org/recettes/poulet.aspx"), null);
  assert.equal(recipeSource(null), null);
  assert.equal(recipeSource("pas une url"), null);
});

// Les helpers bas niveau doivent être cohérents avec recipeSource (même
// logique utilisée par les routes d'import).
test("helpers de reconnaissance d'URL cohérents avec recipeSource", () => {
  assert.equal(isHelloFreshRecipeUrl(`https://www.hellofresh.fr/recipes/x-${HF_ID}`), true);
  assert.equal(isHelloFreshRecipeUrl("https://www.hellofresh.fr/recipes/"), false);
  assert.equal(isJowUrl("https://jow.fr/recipes/crepes-maison-83jq25q5innb780q0wzk"), true);
  assert.equal(isJowUrl("https://jow.fr/recipes/crepes-maison-ABC123"), true);
  assert.equal(isJowUrl("https://jow.fr/recipes/"), false);
  assert.equal(isJowUrl("https://jow.fr/recipes"), false);
  assert.equal(isQuitoqueRecipeUrl("https://www.quitoque.fr/recettes/poulet-tikka-masala"), true);
  assert.equal(isQuitoqueRecipeUrl("https://www.quitoque.fr/recettes"), false);
});

// ─── 422 : page récupérée sans ingrédients ni étapes ───────────────────────
// Fixtures HTML locales (pas d'appel réseau) représentant la vraie page de
// liste "/recipes/" (ou équivalent) : aucune donnée de recette dedans. Les
// routes d'import renvoient 422 quand ingredients.length === 0 &&
// steps.length === 0 (voir src/app/api/recipes/import-*/route.ts).

const HELLOFRESH_LIST_PAGE_HTML = `<!DOCTYPE html>
<html><head><title>Idées de Recettes avec HelloFresh</title></head>
<body>
  <h1>Idées de Recettes avec HelloFresh</h1>
  <nav><a href="/recipes/under-30-minutes">Moins de 30 min</a></nav>
  <div class="card">Pas de JSON-LD de recette ici, juste des liens.</div>
</body></html>`;

const JOW_HOME_PAGE_HTML = `<!DOCTYPE html>
<html><head><title>Jow</title></head>
<body><h1>Jow, l'appli de courses et de recettes</h1></body></html>`;

const QUITOQUE_LIST_PAGE_HTML = `<!DOCTYPE html>
<html><head><title>Nos recettes</title>
<meta property="og:description" content="Toutes nos recettes">
</head>
<body><h1>Nos recettes</h1></body></html>`;

test("HelloFresh : page de liste → ni ingrédients ni étapes", () => {
  const parsed = parseHelloFreshPage(HELLOFRESH_LIST_PAGE_HTML);
  assert.equal(parsed.ingredients.length, 0);
  assert.equal(parsed.steps.length, 0);
});

test("Jow : page sans données de recette → ni ingrédients ni étapes (pas de crash)", () => {
  const parsed = parseJowRecipe(JOW_HOME_PAGE_HTML);
  assert.equal(parsed.ingredients.length, 0);
  assert.equal(parsed.steps.length, 0);
});

test("Quitoque : page de liste → ni ingrédients ni étapes", () => {
  assert.equal(parseQuitoqueJsonLd(QUITOQUE_LIST_PAGE_HTML), null);
  const parsed = parseQuitoqueHtml(QUITOQUE_LIST_PAGE_HTML);
  assert.equal(parsed.ingredients.length, 0);
  assert.equal(parsed.steps.length, 0);
});

// Contre-exemple : une vraie recette (JSON-LD) a bien des ingrédients et des
// étapes, pour vérifier que la détection ne rejette pas tout.
const HELLOFRESH_RECIPE_PAGE_HTML = `<!DOCTYPE html>
<html><head><title>Poulet rôti</title></head>
<body>
<h1>Poulet rôti au citron</h1>
<script type="application/ld+json">
{
  "@type": "Recipe",
  "name": "Poulet rôti au citron",
  "recipeIngredient": ["500 g poulet", "1 citron"],
  "recipeInstructions": ["Préchauffer le four", "Enfourner 40 minutes"],
  "recipeYield": "4"
}
</script>
</body></html>`;

test("HelloFresh : vraie page de recette → ingrédients et étapes présents", () => {
  const parsed = parseHelloFreshPage(HELLOFRESH_RECIPE_PAGE_HTML);
  assert.equal(parsed.ingredients.length, 2);
  assert.equal(parsed.steps.length, 2);
});

test("recipeSource : liens http des hôtes autorisés acceptés, le reste refusé", () => {
  assert.equal(recipeSource(`http://www.hellofresh.fr/recipes/poulet-roti-au-citron-${HF_ID}`), "hellofresh");
  assert.equal(recipeSource("http://jow.fr/recipes/crepes-maison-83jq25q5innb780q0wzk"), "jow");
  assert.equal(recipeSource("http://www.quitoque.fr/recettes/poulet-tikka-masala"), "quitoque");
  assert.equal(recipeSource(`http://127.0.0.1/recipes/x-${HF_ID}`), null);
  assert.equal(recipeSource(`http://hellofresh.fr.evil.com/recipes/x-${HF_ID}`), null);
  assert.equal(recipeSource(`https://user:pass@www.hellofresh.fr/recipes/x-${HF_ID}`), null);
  assert.equal(recipeSource(`http://www.hellofresh.fr:8080/recipes/x-${HF_ID}`), null);
});
