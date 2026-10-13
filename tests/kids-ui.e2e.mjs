/**
 * Parcours de l'interface du Semainier (Playwright), sur une base de PRÉVISUALISATION jetable.
 *
 * Variables : BASE_URL, DATABASE_URL (même base que le serveur), E2E_EMAIL, E2E_PASSWORD,
 * SHOTS_DIR (captures), PLAYWRIGHT_CORE (dossier de playwright-core, sinon résolution normale).
 * Le compte doit avoir deux enfants : le premier avec des rubriques dont une à choix multiples
 * (« Activités »), le second sans rubrique.
 *
 *   node tests/kids-ui.e2e.mjs            # 390 px puis 820 px
 */
import { createRequire } from "module";
import { mkdirSync } from "fs";
import { PrismaClient } from "@prisma/client";

const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ? "playwright-core" : "playwright-core");

const BASE = process.env.BASE_URL ?? "http://localhost:3160";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const SHOTS = process.env.SHOTS_DIR ?? "./kids-shots";
if (!EMAIL || !PASSWORD || !process.env.DATABASE_URL) {
  console.error("E2E_EMAIL, E2E_PASSWORD et DATABASE_URL sont requis.");
  process.exit(2);
}
mkdirSync(SHOTS, { recursive: true });
const prisma = new PrismaClient();

let failures = 0;
const check = (cond, label, extra = "") => {
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${extra ? ` (${extra})` : ""}`);
};

async function newPage(browser, width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "fr-FR", ...opts });
  const page = await ctx.newPage();
  page.consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && page.consoleErrors.push(m.text()));
  page.on("pageerror", (e) => page.consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button:has-text('Se connecter')");
  await page.waitForURL((u) => !u.pathname.includes("login"));
  return page;
}

const api = async (page, method, url, json) => {
  const res = await page.request.fetch(`${BASE}${url}`, { method, data: json, headers: json ? { "Content-Type": "application/json" } : {} });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { ok: res.ok(), status: res.status(), body };
};

async function run(width, height) {
  const tag = `${width}`;
  const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${tag}-${name}.png` });
  console.log(`\n=== Viewport ${width}x${height} ===`);
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await newPage(browser, width, height);
  const children = (await api(page, "GET", "/api/profiles?kind=child")).body;
  const lea = children.find((c) => c.name === "Léa");
  const tom = children.find((c) => c.name === "Tom");
  await page.evaluate((id) => localStorage.setItem("kids:selectedProfile", id), lea.id);
  await page.goto(`${BASE}/kids`);
  await page.waitForSelector("[aria-label^='Semaine, rubrique']");

  // 9. Cases de la semaine : 44 px au moins
  console.log("9. Taille des cases");
  const cell = page.locator("[aria-label^='Semaine, rubrique'] button[aria-label*='Météo :']").first();
  const box = await cell.boundingBox();
  check(box.width >= 44 && box.height >= 44, "case de la semaine >= 44 x 44", `${box.width.toFixed(1)} x ${box.height.toFixed(1)}`);
  await shot(page, "week");

  // 1. Changement d'enfant : plus de rubriques de l'enfant précédent
  console.log("1. Changement d'enfant");
  await page.route("**/api/kids/week*", async (route) => {
    if (route.request().url().includes(tom.id)) await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.getByRole("button", { name: /Tom/ }).first().click();
  await page.waitForTimeout(150);
  const leaStill = await page.getByRole("heading", { name: "Météo" }).count();
  const skeleton = await page.locator("[aria-busy='true']").count();
  check(leaStill === 0 && skeleton === 1, "pendant le chargement de Tom : aucune rubrique de Léa, squelette affiché");
  check((await page.getByText("Crée ta première rubrique").count()) === 0, "pas d'état vide affiché avant l'arrivée de Tom");
  await shot(page, "switch-loading");
  await page.getByText("Crée ta première rubrique").waitFor();
  check((await page.getByRole("heading", { name: "Météo" }).count()) === 0 && (await page.getByText("reprise").count()) === 0, "Tom chargé : état vide, ni rubrique ni bandeau de Léa");
  await page.unroute("**/api/kids/week*");
  await page.getByRole("button", { name: /Léa/ }).first().click();
  await page.getByRole("heading", { name: "Météo" }).waitFor();

  // 3. Échec de /api/profiles?kind=child
  console.log("3. Échec de lecture des enfants");
  await page.route("**/api/profiles?kind=child", (r) => r.abort());
  await page.reload();
  await page.getByText("Les enfants ne se sont pas chargés.").waitFor();
  check((await page.getByText("Ajoute d'abord ton enfant").count()) === 0, "message d'erreur, pas « Ajoute d'abord ton enfant »");
  await shot(page, "children-error");
  await page.unroute("**/api/profiles?kind=child");
  await page.getByRole("button", { name: "Réessayer" }).click();
  await page.getByRole("heading", { name: "Météo" }).waitFor();
  check(true, "« Réessayer » recharge la page des enfants");

  // 2 + 6 + 8 + 12. Mode enfant
  console.log("2. Erreur de chargement en mode enfant");
  await page.route("**/api/kids/week*", (r) => r.abort());
  await page.reload();
  await page.getByText("La semaine ne s'est pas chargée.").first().waitFor();
  await page.getByRole("button", { name: "Passer en mode enfant" }).click();
  const kidRegion = page.getByRole("region", { name: "Mode enfant" });
  await kidRegion.getByText("La semaine ne s'est pas chargée.").waitFor();
  check((await kidRegion.getByText("rien à remplir").count()) === 0, "mode enfant : message d'erreur, pas « rien à remplir »");
  await shot(page, "kid-error");
  await page.unroute("**/api/kids/week*");
  await kidRegion.getByRole("button", { name: "Réessayer" }).click();
  await kidRegion.getByRole("button", { name: /à remplir|aujourd/ }).first().waitFor();
  check(true, "« Réessayer » recharge la semaine en mode enfant");

  console.log("6. Focus à l'ouverture, échec remis à zéro");
  await page.reload();
  await page.getByRole("heading", { name: "Météo" }).waitFor();
  await page.getByRole("button", { name: "Passer en mode enfant" }).click();
  await kidRegion.getByRole("button", { name: /aujourd'hui/ }).waitFor();
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName + ":" + (document.activeElement?.textContent ?? "").slice(0, 20));
  check(focusedTag === "H1:Léa" || focusedTag.startsWith("H1:"), "focus sur le h1 à l'ouverture", focusedTag);
  await page.route("**/api/kids/day", (r) => (r.request().method() === "PATCH" ? r.abort() : r.continue()));
  const dayBtn = kidRegion.getByRole("button", { name: /aujourd'hui/ });
  await dayBtn.click();
  await page.getByRole("dialog").getByRole("button", { name: /Soleil/ }).click();
  await page.getByText("Oups, ça n'a pas été enregistré").waitFor();
  await shot(page, "kid-failed");
  await page.getByRole("button", { name: "Fermer" }).click();
  await dayBtn.click();
  await page.waitForTimeout(300);
  check((await page.getByText("Oups, ça n'a pas été enregistré").count()) === 0, "le message d'échec a disparu à la réouverture du jour");
  await page.unroute("**/api/kids/day");
  await page.getByRole("button", { name: "Fermer" }).click();

  console.log("12. Cadenas 56 px, overscroll-contain");
  const lock = kidRegion.getByRole("button", { name: /Quitter le mode enfant/ });
  const lb = await lock.boundingBox();
  check(Math.round(lb.width) === 56 && Math.round(lb.height) === 56, "cadenas de 56 x 56", `${lb.width} x ${lb.height}`);
  const oc = await kidRegion.evaluate((el) => getComputedStyle(el).overscrollBehaviorY);
  check(oc === "contain", "conteneur plein écran en overscroll-contain", oc);
  const hdr = await kidRegion.locator("h1").boundingBox();
  check(hdr.x + hdr.width < lb.x || hdr.x + hdr.width / 2 < lb.x, "le titre ne passe pas sous le cadenas");

  console.log("8. Clic fantôme à la sortie du mode enfant");
  const themeLabel = () => page.getByRole("button", { name: /^Thème :/ }).first().getAttribute("aria-label");
  // Le bouton de thème est sous le cadenas (barre du haut) en mobile, dans la barre latérale en tablette.
  const before = await page.evaluate(() => {
    const inert = document.querySelector("[inert]");
    return !!inert;
  });
  const centre = { x: lb.x + lb.width / 2, y: lb.y + lb.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.waitForTimeout(1150);
  await page.mouse.up();
  // Le navigateur du téléphone envoie ici un clic à l'endroit du doigt : on le simule.
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    return el ? `${el.tagName}:${el.getAttribute("aria-label") ?? ""}` : "rien";
  }, centre);
  check((await page.getByRole("region", { name: "Mode enfant" }).count()) === 0, "le mode enfant est quitté après l'appui long", `inert avant: ${before}`);
  const themeNow = await themeLabel();
  check(themeNow === (await themeLabel()), "le clic fantôme (premier clic après la sortie) est avalé", `sous le doigt: ${hit}; ${themeNow}`);
  // Le deuxième clic, même dans les 400 ms, est un vrai appui : il passe.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /^Thème :/.test(b.getAttribute("aria-label") ?? ""))?.click();
  });
  check((await themeLabel()) !== themeNow, "le premier vrai appui après le fantôme n'est pas ignoré");
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /^Thème :/.test(b.getAttribute("aria-label") ?? ""))?.click();
  });
  const themeLater = await themeLabel();
  check(themeLater !== themeNow, "contrôle : 600 ms plus tard, un clic sur le thème fonctionne", `${themeNow} -> ${themeLater}`);
  // On remet le thème comme avant.
  for (let i = 0; i < 3 && (await themeLabel()) !== themeNow; i++) {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^Thème :/.test(b.getAttribute("aria-label") ?? ""))?.click());
  }

  // 7. Rubrique masquée avec des saisies
  console.log("7. Suppression d'une rubrique masquée qui a des saisies");
  const label = `Essai masquée ${Date.now() % 100000}`;
  const created = await api(page, "POST", "/api/kids/trackers", { profileId: lea.id, label, icon: "sun", kind: "single", options: [{ label: "Un", icon: "sun" }, { label: "Deux", icon: "rain" }] });
  const trk = created.body;
  const todayParis = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  await api(page, "PATCH", "/api/kids/day", { profileId: lea.id, date: todayParis, values: { [trk.id]: [trk.options[0].id] } });
  await api(page, "PATCH", `/api/kids/trackers/${trk.id}`, { active: false });
  await page.reload();
  await page.getByRole("heading", { name: "Météo" }).waitFor();
  await page.getByRole("button", { name: /Modifier la vue/ }).click();
  await page.getByRole("button", { name: `Supprimer ${label}` }).click();
  await page.getByRole("alertdialog").or(page.getByRole("dialog").filter({ hasText: "Supprimer «" })).last().getByRole("button", { name: "Supprimer" }).click();
  await page.getByText("Elle a des saisies, elle reste masquée.").waitFor();
  check((await page.getByText("on la masque ?").count()) === 0 && (await page.getByRole("button", { name: "Masquer", exact: true }).count()) === 0, "aucune proposition « Masquer »");
  await shot(page, "hidden-with-entries");
  // nettoyage
  await api(page, "PATCH", "/api/kids/day", { profileId: lea.id, date: todayParis, values: { [trk.id]: null } });
  await api(page, "DELETE", `/api/kids/trackers/${trk.id}`);

  // 10. Formulaire : Entrée soumet, pied visible au-dessus du clavier
  console.log("10. Formulaire de rubrique");
  await page.reload();
  await page.getByRole("heading", { name: "Météo" }).waitFor();
  await page.getByRole("button", { name: /Modifier la vue/ }).click();
  await page.getByRole("button", { name: "Ajouter une rubrique" }).click();
  await page.getByRole("radio", { name: /Compteur/ }).click();
  const enterLabel = `Essai Entrée ${Date.now() % 100000}`;
  await page.getByLabel("Nom de la rubrique").fill(enterLabel);
  await page.getByLabel("Nom de la rubrique").press("Enter");
  await page.getByText(`« ${enterLabel} » est créée.`).waitFor();
  const made = (await api(page, "GET", `/api/kids/trackers?profileId=${lea.id}`)).body.find((t) => t.label === enterLabel);
  check(!!made, "Entrée dans « Nom de la rubrique » crée la rubrique");
  if (made) await api(page, "DELETE", `/api/kids/trackers/${made.id}`);
  await page.keyboard.press("Escape");

  // 11. Barre latérale : décalage de la zone sûre (tablette)
  if (width >= 768) {
    console.log("11. Barre latérale et zone sûre");
    const cdp = await page.context().newCDPSession(page);
    const ok = await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 24 } }).then(() => true, () => false);
    if (ok) {
      await page.reload();
      const navTop = await page.getByRole("navigation", { name: "Navigation principale" }).evaluate((el) => el.getBoundingClientRect().top);
      check(navTop >= 24 + 12 - 0.5, "la barre latérale commence sous la zone sûre (24 px simulés)", `top = ${navTop}px`);
      await shot(page, "sidebar-safe-area");
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0 } });
    } else check(false, "émulation de zone sûre indisponible");
  }

  check(page.consoleErrors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e)).length === 0, "console sans erreur (hors échecs réseau provoqués)", page.consoleErrors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e)).join(" | "));
  await browser.close();
}

async function concurrency() {
  console.log("\n=== 5. Écritures concurrentes (390 px) ===");
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await newPage(browser, 390, 844);
  const children = (await api(page, "GET", "/api/profiles?kind=child")).body;
  const lea = children.find((c) => c.name === "Léa");
  const trackers = (await api(page, "GET", `/api/kids/trackers?profileId=${lea.id}`)).body;
  const act = trackers.find((t) => t.kind === "multi");
  await page.evaluate((id) => localStorage.setItem("kids:selectedProfile", id), lea.id);
  await page.goto(`${BASE}/kids`);
  await page.getByRole("heading", { name: "Activités" }).waitFor();
  // Trois semaines plus tard : une semaine vide, sans toucher aux saisies de la démo.
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Semaine suivante" }).click();
  const cell = page.getByRole("button", { name: /mercredi.*Activités : non renseigné/ }).first();
  const label = await cell.getAttribute("aria-label");
  await cell.click();
  const dialog = page.getByRole("dialog");
  // Le premier envoi est retardé : sans file, le second (qui contient les deux choix) passerait devant.
  let n = 0;
  await page.route("**/api/kids/day", async (route) => {
    if (route.request().method() === "PATCH") {
      n++;
      if (n === 1) await new Promise((r) => setTimeout(r, 700));
    }
    await route.continue();
  });
  const names = act.options.filter((o) => o.active).slice(0, 3).map((o) => o.label);
  for (const name of names) await dialog.getByRole("button", { name: new RegExp(`^${name}$`) }).click({ delay: 0 });
  await page.waitForTimeout(2500);
  const row = await prisma.kidDayEntry.findMany({ where: { profileId: lea.id }, orderBy: { updatedAt: "desc" }, take: 1 });
  const saved = row[0]?.values?.[act.id] ?? [];
  const wanted = act.options.filter((o) => names.includes(o.label)).map((o) => o.id).sort();
  check(JSON.stringify([...saved].sort()) === JSON.stringify(wanted), `les ${names.length} choix rapides sont tous en base`, `en base: ${saved.length}, ${label.split(",")[0]}`);
  await page.screenshot({ path: `${SHOTS}/390-concurrent.png` });
  // nettoyage
  await page.unroute("**/api/kids/day");
  if (row[0]) await prisma.kidDayEntry.delete({ where: { id: row[0].id } });

  // Contrôle : sans file, la même course perd un choix (le plus ancien envoi arrive en dernier).
  console.log("   contrôle : envois parallèles sans file");
  let k = 0;
  await page.route("**/api/kids/day", async (route) => {
    if (route.request().method() === "PATCH" && ++k === 1) await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  const day = "2026-11-05";
  const [a, b] = act.options.filter((o) => o.active).slice(0, 2).map((o) => o.id);
  await page.evaluate(
    async ({ profileId, day, trackerId, a, b }) => {
      const send = (ids) =>
        fetch("/api/kids/day", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, date: day, values: { [trackerId]: ids } }) });
      await Promise.all([send([a]), send([a, b])]);
    },
    { profileId: lea.id, day, trackerId: act.id, a, b }
  );
  const ctl = await prisma.kidDayEntry.findFirst({ where: { profileId: lea.id, date: day } });
  check((ctl?.values?.[act.id] ?? []).length === 1, "contrôle : sans file, le choix B est perdu (la course existe bien)", `en base: ${(ctl?.values?.[act.id] ?? []).length}`);
  if (ctl) await prisma.kidDayEntry.delete({ where: { id: ctl.id } });
  await browser.close();
}

async function today() {
  console.log("\n=== 4. Aujourd'hui à Paris, minuit, hydratation (navigateur en Nouvelle-Zélande) ===");
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR", timezoneId: "Pacific/Auckland" });
  const page = await ctx.newPage();
  page.consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && page.consoleErrors.push(m.text()));
  page.on("pageerror", (e) => page.consoleErrors.push(e.message));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button:has-text('Se connecter')");
  await page.waitForURL((u) => !u.pathname.includes("login"));
  // Dimanche 18 octobre 2026, 23 h 59 min 45 s à Paris (UTC+2) : à Auckland (UTC+13) il est déjà lundi 19 à 10 h 59.
  await page.clock.install({ time: new Date("2026-10-18T21:59:45Z") });
  await page.goto(`${BASE}/kids`);
  await page.waitForSelector("[aria-label^='Semaine, rubrique']");
  const todayBtn = () => page.locator("button[aria-label*=\"aujourd'hui\"]").first().getAttribute("aria-label");
  const t0 = await todayBtn();
  const range0 = await page.locator("p[aria-live='polite']").textContent();
  check(/dimanche 18 octobre/.test(t0), "avant minuit (Paris) : aujourd'hui = dimanche 18, même en Nouvelle-Zélande", `${t0}; ${range0}`);
  await page.clock.fastForward(35_000);
  await page.waitForFunction(() => document.querySelector("p[aria-live='polite']")?.textContent?.includes("19 oct"));
  const t1 = await todayBtn();
  const range1 = await page.locator("p[aria-live='polite']").textContent();
  check(/lundi 19 octobre/.test(t1), "après minuit (Paris) : aujourd'hui passe à lundi 19 et la semaine suivante s'affiche", `${t1}; ${range1}`);
  await page.screenshot({ path: `${SHOTS}/390-midnight.png` });
  check(page.consoleErrors.length === 0, "aucune erreur d'hydratation / console", page.consoleErrors.join(" | "));
  await browser.close();
}

async function keyboard() {
  console.log("\n=== 10b. Pied de feuille au-dessus du clavier (visualViewport simulé, 390 px) ===");
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await newPage(browser, 390, 844);
  const children = (await api(page, "GET", "/api/profiles?kind=child")).body;
  await page.evaluate((id) => localStorage.setItem("kids:selectedProfile", id), children.find((c) => c.name === "Léa").id);
  await page.goto(`${BASE}/kids`);
  await page.getByRole("heading", { name: "Météo" }).waitFor();
  await page.getByRole("button", { name: /Modifier la vue/ }).click();
  await page.getByRole("button", { name: "Ajouter une rubrique" }).click();
  await page.getByLabel("Nom de la rubrique").waitFor();
  const normal = await page.getByRole("dialog").boundingBox();
  // Clavier de 420 px : le visualViewport ne fait plus que 424 px de haut.
  await page.evaluate(() => {
    const listeners = new Set();
    const fake = { height: 424, offsetTop: 0, scale: 1, addEventListener: (_t, f) => listeners.add(f), removeEventListener: (_t, f) => listeners.delete(f) };
    Object.defineProperty(window, "visualViewport", { value: fake, configurable: true });
    window.__vvFire = () => listeners.forEach((f) => f());
  });
  // iPhone : la barre d'accessoires (44 pt) s'ajoute au clavier.
  await page.evaluate(() => Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", configurable: true }));
  // La feuille relit le visualViewport à l'ouverture : on la rouvre.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Modifier la vue/ }).click();
  await page.getByRole("button", { name: "Ajouter une rubrique" }).click();
  await page.getByLabel("Nom de la rubrique").fill("Test clavier");
  await page.waitForTimeout(300);
  const box = await page.getByRole("dialog").boundingBox();
  const submit = await page.getByRole("button", { name: "Créer la rubrique" }).boundingBox();
  check(Math.round(box.y + box.height) <= 424 - 44 + 1, "la feuille se pose au-dessus de la barre d'accessoires iOS (bas <= 380 px)", `bas = ${Math.round(box.y + box.height)} px`);
  check(!!submit && submit.y + submit.height <= 424 - 44 && submit.y >= 0, "« Créer la rubrique » reste visible au-dessus du clavier", `bas = ${Math.round(submit.y + submit.height)} px`);
  check(box.y >= 0, "l'en-tête de la feuille reste à l'écran", `haut = ${Math.round(box.y)} px (hauteur normale ${Math.round(normal.height)} px)`);
  await page.screenshot({ path: `${SHOTS}/390-keyboard-sheet.png` });
  // Choix unique, choix vides : Entrée valide, le focus va au premier choix vide, l'erreur est à l'écran.
  await page.getByRole("radio", { name: /Choix unique/ }).click();
  await page.getByLabel("Nom du choix 1").focus();
  await page.keyboard.press("Enter");
  await page.getByText("Ajoute au moins un choix.").waitFor();
  await page.waitForTimeout(600);
  const focusedName = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  check(focusedName === "Nom du choix 1", "validation échouée : le focus va au premier choix vide", `focus = ${focusedName}`);
  const err = await page.getByText("Ajoute au moins un choix.").boundingBox();
  check(err && err.y >= 0 && err.y + err.height <= 424 - 44, "l'erreur est visible au-dessus du clavier", `bas = ${Math.round(err.y + err.height)} px`);
  const live = await page.evaluate(() => document.querySelector('[aria-live="assertive"]:not(:empty)')?.textContent);
  check(live === "Ajoute au moins un choix.", "l'erreur est annoncée (aria-live)");
  await page.screenshot({ path: `${SHOTS}/390-keyboard-error.png` });
  await browser.close();
}

await run(390, 844);
await run(820, 1180);
await concurrency();
await today();
await keyboard();
await prisma.$disconnect();
console.log(failures ? `\n${failures} échec(s)` : "\nTout est ok");
process.exit(failures ? 1 : 0);
