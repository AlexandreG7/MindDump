// Vérifie canonique et robots de chaque route publique sur un serveur lancé
// (`npm run build && npm start`, puis `npm run test:seo`).
// BASE_URL par défaut : http://localhost:3000. Aucune dépendance.
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const SITE = "https://minddump.fr";

const indexable = [
  ["/", SITE],
  ["/charge-mentale", `${SITE}/charge-mentale`],
  ["/liste-de-courses-partagee", `${SITE}/liste-de-courses-partagee`],
  ["/menus-de-la-semaine", `${SITE}/menus-de-la-semaine`],
  ["/calendrier-familial-partage", `${SITE}/calendrier-familial-partage`],
  ["/rendez-vous-famille", `${SITE}/rendez-vous-famille`],
  ["/echeances-administratives-famille", `${SITE}/echeances-administratives-famille`],
  ["/docs", `${SITE}/docs`],
];
// Variantes à paramètres : même canonique que la page sans paramètre.
const variants = [
  ["/?utm_source=x&ref=y", SITE],
  ["/charge-mentale?utm_source=x", `${SITE}/charge-mentale`],
  ["/docs?ref=x", `${SITE}/docs`],
];
// Pages qui répondent 200 sans connexion et ne doivent pas être indexées :
// noindex, et surtout aucune canonique (donc pas de pointage vers l'accueil).
const noindex = [
  "/login", "/login?callbackUrl=%2Ftodos", "/register", "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe", "/confidentialite", "/hors-ligne", "/wall/abc",
];

let failures = 0;
const fail = (m) => { failures++; console.error("ÉCHEC", m); };

async function head(path) {
  const res = await fetch(base + path, { redirect: "manual" });
  const html = await res.text();
  const canon = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
  const robots = [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]);
  return { status: res.status, canon, robots };
}

for (const [path, expected] of [...indexable, ...variants]) {
  const { status, canon, robots } = await head(path);
  if (status !== 200) fail(`${path} : statut ${status}`);
  else if (canon.length !== 1) fail(`${path} : ${canon.length} canonique(s)`);
  else if (canon[0].replace(/\/$/, "") !== expected) fail(`${path} : canonique ${canon[0]}, attendu ${expected}`);
  if (robots.some((r) => /noindex/.test(r))) fail(`${path} : noindex sur une page indexable`);
}

for (const path of noindex) {
  const { status, canon, robots } = await head(path);
  if (status !== 200) fail(`${path} : statut ${status}`);
  if (canon.length) fail(`${path} : canonique ${canon[0]} sur une page noindex`);
  if (!robots.some((r) => /noindex/.test(r))) fail(`${path} : noindex absent`);
}

// robots.txt : chaque page du sitemap est autorisée, chaque noindex est bloquée.
const robotsTxt = await (await fetch(base + "/robots.txt")).text();
const disallowed = [...robotsTxt.matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]);
for (const [path] of indexable) {
  if (path !== "/" && disallowed.some((d) => path.startsWith(d))) fail(`${path} : bloquée par robots.txt`);
}
const sitemap = await (await fetch(base + "/sitemap.xml")).text();
const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(/\/$/, ""));
if (locs.join() !== indexable.map(([, c]) => c).join()) fail(`sitemap : ${locs.join(", ")}`);

console.log(failures ? `${failures} échec(s)` : "SEO canonique : OK");
process.exit(failures ? 1 : 0);
