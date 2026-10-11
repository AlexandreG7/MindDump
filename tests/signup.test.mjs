/**
 * Test de la liste blanche d'inscription (src/lib/signupAllowlist.ts, e-mails
 * src/lib/email.ts) : MindDump est en bêta privée, personne hors ALLOWED_SIGNUP_EMAILS
 * (ou sans invitation : tests/beta.test.mjs) ne peut créer de compte, mais les comptes existants se connectent et lient un
 * fournisseur comme avant (ADR 0001 : rien ne disparaît pour son auteur).
 *
 * Deux serveurs MindDump sur une base JETABLE (scripts/test-signup.sh) :
 *   BASE_URL         ALLOWED_SIGNUP_EMAILS = « ALICE@…, bob@… » (casse et espaces variés)
 *   BASE_URL_CLOSED  ALLOWED_SIGNUP_EMAILS vide
 * Le fournisseur OAuth `test-oidc` n'existe pas dans un serveur de production :
 * les callbacks NextAuth (signIn, adaptateur) sont donc appelés directement, depuis
 * ce processus qui l'active (OAUTH_TEST_ISSUER, hors production), comme le fait
 * NextAuth au retour du fournisseur.
 *
 * Lancer avec tsx : npm run test:signup
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

if (process.env.OWNERSHIP_TEST_DB !== "disposable") {
  console.error("Refus : OWNERSHIP_TEST_DB=disposable requis (ce test écrit dans la base).");
  process.exit(2);
}
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CLOSED_URL = process.env.BASE_URL_CLOSED || "http://localhost:3001";

const run = process.env.SIGNUP_TEST_RUN_ID || randomBytes(4).toString("hex");
const LIST = ` ALICE-${run}@Test.Local , bob-${run}@test.local ,, kelly-${run}@test.local `;
// Le processus de test lit la même liste que le serveur A pour les callbacks directs.
process.env.ALLOWED_SIGNUP_EMAILS = LIST;
process.env.NODE_ENV = "development";
process.env.OAUTH_TEST_ISSUER = "http://localhost:4010";

const unwrap = (mod) => ({ ...mod.default, ...mod });
const { isSignupAllowed, isSignupOpen, parseAllowlist, allowedSignupEmails } = unwrap(await import("../src/lib/signupAllowlist.ts"));
const { authOptions, SIGNUP_CLOSED_URL } = unwrap(await import("../src/lib/auth.ts"));
const { linkAuthOptions } = unwrap(await import("../src/lib/accountLinking.ts"));
const { hashPassword } = unwrap(await import("../src/lib/password.ts"));
const { normalizeEmail, parseEmail } = unwrap(await import("../src/lib/email.ts"));
const { resetPassword } = unwrap(await import("../src/lib/passwordReset.ts"));
const { createHash } = await import("node:crypto");
const { oauthErrorMessage } = unwrap(await import("../src/components/OAuthButtons.tsx"));

const prisma = new PrismaClient();
let failures = 0;
let checks = 0;
const check = (cond, label) => {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
};

const CLOSED_MESSAGE = "Les inscriptions sont fermées pour le moment.";
const userByEmail = (email) => prisma.user.findUnique({ where: { email } });
const countUsers = () => prisma.user.count();

// Chaque appel vient d'une « adresse IP » différente (en-tête ajouté par le proxy) :
// la limite de débit par IP (A2) ne doit pas fausser les autres cas. Voir le cas dédié plus bas.
let ipCounter = 0;
const freshIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

async function register(base, email, extra = {}, ip = freshIp()) {
  const started = performance.now();
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ name: "Test", email, password: "motdepasse-solide", consent: true, ...extra }),
  });
  const ms = performance.now() - started;
  return { res, status: res.status, body: await res.json().catch(() => null), ms };
}

/** Connexion e-mail / mot de passe par NextAuth (jeton CSRF, puis callback credentials). */
async function credentialsLogin(base, email, password) {
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }).toString(),
  });
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  const session = cookies.find((c) => c.includes("next-auth.session-token="));
  if (!session) return null;
  const me = await fetch(`${base}/api/auth/session`, { headers: { cookie: [csrfCookie, session].join("; ") } });
  return (await me.json())?.user ?? null;
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const oauthAccount = (providerAccountId) => ({ provider: "test-oidc", type: "oauth", providerAccountId });
// `emailVerified` : valeur de `email_verified` du profil du fournisseur (A4).
const signInCallback = (options, email, providerAccountId = `sub-${randomBytes(4).toString("hex")}`, emailVerified = true) =>
  options.callbacks.signIn({
    user: { id: providerAccountId, email, name: "Test" },
    account: oauthAccount(providerAccountId),
    profile: emailVerified === "absent" ? { email } : { email, email_verified: emailVerified },
  });

async function main() {
  const outsider = `eve-${run}@test.local`;
  const existingOutsider = `carol-${run}@test.local`;

  console.log("Helper isSignupAllowed");
  {
    check(isSignupAllowed(`alice-${run}@test.local`), "adresse de la liste (minuscules)");
    check(isSignupAllowed(`  ALICE-${run}@TEST.LOCAL  `), "casse et espaces variés acceptés");
    check(isSignupAllowed(`BOB-${run}@test.local`), "deuxième adresse, malgré les virgules et espaces en trop");
    check(!isSignupAllowed(outsider), "adresse hors liste refusée");
    check(!isSignupAllowed(`alice-${run}@test.local.evil.com`) && !isSignupAllowed(`xalice-${run}@test.local`), "pas de correspondance partielle");
    check(!isSignupAllowed("") && !isSignupAllowed("   ") && !isSignupAllowed(null) && !isSignupAllowed(undefined) && !isSignupAllowed(42), "vide, blanc, null, nombre : refusés");
    check(isSignupOpen(), "liste renseignée : inscriptions ouvertes pour la liste");
    for (const [label, value] of [["vide", ""], ["espaces", "   "], ["virgules seules", " , ,, "], ["absente", undefined]]) {
      if (value === undefined) delete process.env.ALLOWED_SIGNUP_EMAILS;
      else process.env.ALLOWED_SIGNUP_EMAILS = value;
      check(!isSignupAllowed(`alice-${run}@test.local`) && !isSignupOpen(), `variable ${label} : aucune inscription, fermé par défaut`);
    }
    process.env.ALLOWED_SIGNUP_EMAILS = LIST;
  }

  console.log("A1 : normalisation unique des e-mails");
  {
    check(normalizeEmail("  ALICE@Test.Local ") === "alice@test.local", "trim + minuscules");
    check(parseEmail("  ALICE@Test.Local ") === "alice@test.local", "parseEmail rend la forme normalisée");
    check(parseEmail("\u212Aelly@test.local") === null, "signe Kelvin (U+212A) refusé, pas replié sur « k »");
    check(normalizeEmail("\u212Aelly@test.local") === "kelly@test.local", "(contexte : NFKC le replierait, d'où le contrôle ASCII avant)");
    check(parseEmail("é@test.local") === null && parseEmail("a@tést.local") === null && parseEmail("a b@test.local") === null, "hors ASCII ou espace : refusé");
    check(parseEmail("a@b") === null && parseEmail("@test.local") === null && parseEmail("a..b@test.local") === null && parseEmail("a@test..local") === null, "formes invalides refusées");
    check(parseEmail(`${"x".repeat(250)}@test.local`) === null, "trop long : refusé");
    check(parseEmail(42) === null && parseEmail(null) === null, "non-chaîne : refusé");
    check(!isSignupAllowed("\u212Aelly-" + run + "@test.local") && isSignupAllowed(`kelly-${run}@test.local`), "liste blanche : « K » ASCII accepté, Kelvin refusé");
  }

  console.log("A5 : lecture tolérante de ALLOWED_SIGNUP_EMAILS");
  {
    const a = parseAllowlist('"a@test.local, B@test.local"').emails;
    check(a.has("a@test.local") && a.has("b@test.local") && a.size === 2, "guillemets doubles en bordure retirés");
    const b = parseAllowlist("'a@test.local';b@test.local").emails;
    check(b.has("a@test.local") && b.has("b@test.local"), "guillemets simples, séparateur point-virgule");
    const c = parseAllowlist("a@test.local\nb@test.local\r\n  c@test.local\t,d@test.local;").emails;
    check(c.size === 4, "retours à la ligne, tabulations, espaces, virgule et point-virgule en trop");
    const d = parseAllowlist("a@test.local, pas-une-adresse, \u212A@test.local, ok@test.local");
    check(d.emails.size === 2 && d.ignored === 2, "entrées invalides ignorées (comptées), les valides conservées");
    const warns = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(" "));
    process.env.ALLOWED_SIGNUP_EMAILS = "secret-nom@test.local, nimportequoi";
    allowedSignupEmails(); allowedSignupEmails(); allowedSignupEmails();
    console.warn = originalWarn;
    check(warns.length === 1, "un seul avertissement pour une même valeur de la variable");
    check(warns[0] && !warns[0].includes("secret-nom") && !warns[0].includes("nimportequoi"), "l'avertissement n'écrit aucune adresse");
    process.env.ALLOWED_SIGNUP_EMAILS = '"pas valide", ;;';
    check(!isSignupOpen(), "isSignupOpen : aucune entrée valide = fermé");
    process.env.ALLOWED_SIGNUP_EMAILS = '"pas valide", ok@test.local';
    check(isSignupOpen(), "isSignupOpen : une entrée valide suffit");
    process.env.ALLOWED_SIGNUP_EMAILS = LIST;
  }

  console.log("Inscription e-mail / mot de passe (liste renseignée)");
  const carolPassword = "mot-de-passe-de-carol";
  await prisma.user.create({
    data: { name: "Carol", email: existingOutsider, password: hashPassword(carolPassword), consentedAt: new Date() },
  });
  {
    const before = await countUsers();
    const refused = await register(BASE_URL, outsider);
    check(refused.status === 403, "hors liste : 403");
    check(refused.body?.error === CLOSED_MESSAGE, "message en français, générique");
    check(!JSON.stringify(refused.body).includes(`alice-${run}`), "le message ne révèle rien de la liste");
    check(!(await userByEmail(outsider)) && (await countUsers()) === before, "aucun utilisateur créé hors liste");

    const accepted = await register(BASE_URL, `ALICE-${run}@Test.Local`);
    check(accepted.status === 201, "dans la liste (autre casse) : 201");
    const alice = await userByEmail(`alice-${run}@test.local`);
    check(!!alice, "utilisateur créé, adresse stockée en minuscules");
    check(!(await userByEmail(`ALICE-${run}@Test.Local`)), "pas de variante à casse mixte en base");
    check(!!alice && (await prisma.group.count({ where: { ownerId: alice.id, isDefault: true } })) === 1, "groupe par défaut créé");
    const aliceLogin = await credentialsLogin(BASE_URL, `ALICE-${run}@Test.Local`, "motdepasse-solide");
    check(aliceLogin?.id === alice?.id, "le compte inscrit se connecte");

    const again = await register(BASE_URL, `bob-${run}@test.local`, { password: "court" });
    check(again.status === 400, "dans la liste mais mot de passe trop court : 400 habituel, rien de créé");
    check(!(await userByEmail(`bob-${run}@test.local`)), "bob n'a pas été créé");

    const dup = await register(BASE_URL, `ALICE-${run}@Test.Local`);
    check(dup.status === 409, "adresse de la liste déjà inscrite : 409 habituel");
    const dupLower = await register(BASE_URL, `alice-${run}@test.local`);
    check(dupLower.status === 409, "même adresse en minuscules : 409 aussi (A1)");
    check((await prisma.user.count({ where: { email: { equals: `alice-${run}@test.local`, mode: "insensitive" } } })) === 1, "A1 : ALICE@ face à alice@ existant, pas de doublon");
    const kelvin = await register(BASE_URL, `\u212Aelly-${run}@test.local`);
    check(kelvin.status === 403 && !(await prisma.user.count({ where: { email: { contains: `elly-${run}`, mode: "insensitive" } } })), "A1 : signe Kelvin refusé (403), rien créé");
    // Course : deux inscriptions de la même adresse (casse différente) en même temps.
    const [r1, r2] = await Promise.all([
      register(BASE_URL, `KELLY-${run}@test.local`),
      register(BASE_URL, `kelly-${run}@TEST.local`),
    ]);
    check([r1.status, r2.status].sort().join() === "201,409", `A1 : course de deux casses de la même adresse (${r1.status}/${r2.status}) : un compte, un 409`);
    check((await prisma.user.count({ where: { email: { equals: `kelly-${run}@test.local`, mode: "insensitive" } } })) === 1, "A1 : un seul compte « kelly » en base");
  }

  console.log("Pas d'énumération (hors liste : inconnu ou déjà inscrit)");
  {
    const unknown = [];
    const known = [];
    let first;
    let second;
    for (let i = 0; i < 9; i++) {
      const a = await register(BASE_URL, `inconnu${i}-${run}@test.local`);
      const b = await register(BASE_URL, existingOutsider);
      unknown.push(a.ms);
      known.push(b.ms);
      first = a;
      second = b;
    }
    check(first.status === 403 && second.status === 403, "même statut 403, que le compte existe ou non");
    check(JSON.stringify(first.body) === JSON.stringify(second.body), "même corps de réponse");
    const gap = Math.abs(median(unknown) - median(known));
    check(gap < 100, `temps comparable (médianes ${median(unknown).toFixed(1)} ms / ${median(known).toFixed(1)} ms)`);
    const empty = await register(BASE_URL, "");
    const missing = await register(BASE_URL, undefined);
    check(empty.status === 403 && missing.status === 403, "e-mail vide ou absent : 403 aussi");
    const garbage = await fetch(`${BASE_URL}/api/auth/register`, { method: "POST", body: "pas du json" });
    check(garbage.status === 403, "corps illisible : 403, pas d'erreur 500");
  }

  console.log("Connexion d'un compte existant hors liste");
  {
    const carol = await credentialsLogin(BASE_URL, existingOutsider, carolPassword);
    check(!!carol?.email && carol.email === existingOutsider, "carol (hors liste) se connecte");
    const wrong = await credentialsLogin(BASE_URL, existingOutsider, "mauvais");
    check(wrong === null, "mauvais mot de passe : toujours refusé");
  }

  console.log("Liste vide (serveur fermé)");
  {
    const before = await countUsers();
    const r = await register(CLOSED_URL, `alice-${run}@test.local`);
    check(r.status === 403 && r.body?.error === CLOSED_MESSAGE, "même une adresse de l'ancienne liste : 403");
    check((await countUsers()) === before, "aucun utilisateur créé");
    const carol = await credentialsLogin(CLOSED_URL, existingOutsider, carolPassword);
    check(carol?.email === existingOutsider, "carol se connecte même quand tout est fermé");
    const alice = await credentialsLogin(CLOSED_URL, `ALICE-${run}@Test.Local`, "motdepasse-solide");
    check(!!alice, "un compte créé quand c'était ouvert se connecte toujours");
  }

  console.log("Pages /register et /login");
  {
    const open = await (await fetch(`${BASE_URL}/register`)).text();
    check(open.includes("Demander un accès à la bêta") && !open.includes("Créer mon compte"), "/register sans jeton : demande d'accès, pas de formulaire d'inscription");
    const closed = await (await fetch(`${CLOSED_URL}/register`)).text();
    check(closed.includes("Demander un accès à la bêta") && !closed.includes("Créer mon compte"), "liste vide : même page de demande d'accès");
    const loginOpen = await (await fetch(`${BASE_URL}/login`)).text();
    const loginClosed = await (await fetch(`${CLOSED_URL}/login`)).text();
    check(loginOpen.includes("Demander un accès") && !loginOpen.includes("Créer un compte"), "/login : le lien devient « Demander un accès »");
    check(loginClosed.includes("Demander un accès") && loginClosed.includes("Se connecter"), "liste vide : lien et connexion présents");
    check(oauthErrorMessage("SignupClosed") === CLOSED_MESSAGE, "/login?error=SignupClosed : message en français");
  }

  console.log("OAuth (fournisseur test-oidc) : nouvel utilisateur");
  {
    check(authOptions.providers.some((p) => p.id === "test-oidc"), "le fournisseur test-oidc est actif dans ce processus");
    check(SIGNUP_CLOSED_URL === "/login?error=SignupClosed", "refus renvoyé vers /login?error=SignupClosed");
    const before = await countUsers();
    check((await signInCallback(authOptions, outsider)) === SIGNUP_CLOSED_URL, "nouvel utilisateur hors liste : redirigé vers /login?error=SignupClosed");
    check((await signInCallback(authOptions, null)) === SIGNUP_CLOSED_URL, "profil sans e-mail : refusé");
    check((await signInCallback(authOptions, `BOB-${run}@Test.Local`)) === true, "nouvel utilisateur dans la liste (autre casse) : accepté");
    check((await signInCallback(authOptions, `bob-${run}@test.local`, undefined, false)) === SIGNUP_CLOSED_URL, "A4 : email_verified=false, même dans la liste : refusé");
    check((await signInCallback(authOptions, `bob-${run}@test.local`, undefined, "false")) === SIGNUP_CLOSED_URL, "A4 : email_verified=\"false\" : refusé");
    check((await signInCallback(authOptions, `bob-${run}@test.local`, undefined, "absent")) === SIGNUP_CLOSED_URL, "A4 : email_verified absent : refusé");
    check((await signInCallback(authOptions, `bob-${run}@test.local`, undefined, "true")) === true, "A4 : email_verified=\"true\" (Apple) : accepté");
    // Postgres replie aussi le signe Kelvin en « k » (lower) : pour un compte « kelly » déjà inscrit,
    // le callback le voit comme existant (NextAuth refuse alors la liaison). Dans tous les cas, aucune création.
    const kellyCount = () => prisma.user.count({ where: { email: { contains: `elly-${run}`, mode: "insensitive" } } });
    const kellyBefore = await kellyCount();
    let kelvinCreate = false;
    try {
      await authOptions.adapter.createUser({ email: `\u212Aelly-${run}@test.local`, name: "Kelvin", emailVerified: null });
      kelvinCreate = true;
    } catch {}
    check(!kelvinCreate && (await kellyCount()) === kellyBefore, "A1 : signe Kelvin refusé par l'adaptateur (aucun compte créé)");
    check((await signInCallback(authOptions, `\u212Aoko-${run}@test.local`)) === SIGNUP_CLOSED_URL, "A1 : signe Kelvin refusé côté OAuth");
    check((await countUsers()) === before, "le callback signIn ne crée rien lui-même");
    // Filet : l'adaptateur (seul chemin de création de NextAuth) refuse aussi.
    let refused = false;
    try {
      await authOptions.adapter.createUser({ email: outsider, name: "Eve", emailVerified: null });
    } catch {
      refused = true;
    }
    check(refused && !(await userByEmail(outsider)), "adaptateur createUser : refuse hors liste, rien en base");
    const created = await authOptions.adapter.createUser({ email: `bob-${run}@test.local`, name: "Bob", emailVerified: null });
    check(!!created?.id && !!(await userByEmail(`bob-${run}@test.local`)), "adaptateur createUser : crée dans la liste");
    // Liste vidée : même un ex-membre de la liste n'est plus accepté.
    process.env.ALLOWED_SIGNUP_EMAILS = "";
    check((await signInCallback(authOptions, `zoe-${run}@test.local`)) === SIGNUP_CLOSED_URL, "liste vide : tout nouvel utilisateur OAuth refusé");
    process.env.ALLOWED_SIGNUP_EMAILS = LIST;
  }

  console.log("OAuth : utilisateur existant et liaison (hors liste)");
  {
    const carol = await userByEmail(existingOutsider);
    // 1. Compte OAuth déjà lié : connexion d'un utilisateur existant, même hors liste, même liste vide.
    const sub = `linked-${run}`;
    await prisma.account.create({
      data: { userId: carol.id, type: "oauth", provider: "test-oidc", providerAccountId: sub, access_token: "x" },
    });
    process.env.ALLOWED_SIGNUP_EMAILS = "";
    check((await signInCallback(authOptions, `autre-adresse-${run}@test.local`, sub)) === true, "compte OAuth déjà lié (e-mail du fournisseur différent) : connexion OK, liste vide");
    // 2. E-mail déjà inscrit : pas de création (NextAuth renvoie son refus « compte existant »).
    check((await signInCallback(authOptions, existingOutsider)) === true, "e-mail d'un compte existant : le callback ne bloque pas (refus habituel OAuthAccountNotLinked)");
    // 3. Liaison depuis le profil (web) et depuis l'app (liaison différée) : aucun utilisateur créé.
    const before = await countUsers();
    for (const [label, intent] of [
      ["web", { userId: carol.id, provider: "test-oidc", nonce: "n1" }],
      ["app mobile", { userId: carol.id, provider: "test-oidc", nonce: "n2", ticketId: "ticket-inexistant" }],
    ]) {
      const link = linkAuthOptions(authOptions, intent);
      const result = await link.callbacks.signIn({
        user: { id: "p", email: `quelquun-${run}@ailleurs.test` },
        account: oauthAccount(`new-${label}-${run}`),
        profile: { email: `quelquun-${run}@ailleurs.test` },
      });
      check(result === true, `liaison ${label} à un compte hors liste (liste vide) : acceptée`);
      const user = await link.adapter.createUser({ email: `quelquun-${run}@ailleurs.test`, emailVerified: null });
      check(user.id === carol.id, `liaison ${label} : « createUser » rend l'utilisateur existant`);
    }
    check((await countUsers()) === before, "la liaison ne crée aucun utilisateur");
    check((await prisma.user.findUnique({ where: { id: carol.id } }))?.email === existingOutsider, "carol est intacte");
    process.env.ALLOWED_SIGNUP_EMAILS = LIST;
  }

  console.log("A1 : comptes existants à casse mixte (ADR 0001)");
  {
    const mixed = `Dora.Mixte-${run}@Test.Local`;
    const mixedPassword = "mot-de-passe-de-dora";
    const dora = await prisma.user.create({
      data: { name: "Dora", email: mixed, password: hashPassword(mixedPassword), consentedAt: new Date() },
    });
    check((await credentialsLogin(BASE_URL, mixed, mixedPassword))?.id === dora.id, "connexion avec l'adresse exacte, casse mixte");
    check((await credentialsLogin(BASE_URL, mixed.toLowerCase(), mixedPassword))?.id === dora.id, "connexion avec l'adresse en minuscules (correspondance unique sans casse)");
    check((await credentialsLogin(BASE_URL, `  ${mixed.toUpperCase()}  `, mixedPassword))?.id === dora.id, "connexion avec majuscules et espaces");
    check((await credentialsLogin(BASE_URL, mixed, "mauvais")) === null, "mauvais mot de passe : refusé");
    // Hérité : deux comptes qui ne diffèrent que par la casse. L'exacte gagne, l'ambigu ne devine pas.
    const twinA = `Twin-${run}@test.local`;
    const twinB = `TWIN-${run}@test.local`;
    const a = await prisma.user.create({ data: { name: "A", email: twinA, password: hashPassword("mdp-twin-a-123"), consentedAt: new Date() } });
    const b = await prisma.user.create({ data: { name: "B", email: twinB, password: hashPassword("mdp-twin-b-123"), consentedAt: new Date() } });
    check((await credentialsLogin(BASE_URL, twinA, "mdp-twin-a-123"))?.id === a.id, "doublons hérités : l'adresse exacte A se connecte à A");
    check((await credentialsLogin(BASE_URL, twinB, "mdp-twin-b-123"))?.id === b.id, "doublons hérités : l'adresse exacte B se connecte à B");
    check((await credentialsLogin(BASE_URL, `twin-${run}@TEST.local`, "mdp-twin-a-123")) === null, "doublons hérités : saisie ambiguë (aucune correspondance exacte) : refusée, on ne devine pas");

    // OAuth : un compte existant (minuscules ou casse mixte) est retrouvé sans tenir compte de la casse.
    check((await signInCallback(authOptions, `ALICE-${run}@TEST.LOCAL`, undefined, false)) === true, "OAuth : e-mail d'un compte existant (autre casse) : pas de création, même non vérifié");
    const found = await authOptions.adapter.getUserByEmail(`ALICE-${run}@TEST.LOCAL`);
    check(found?.email === `alice-${run}@test.local`, "adaptateur getUserByEmail : retrouve le compte malgré la casse");
    const foundMixed = await authOptions.adapter.getUserByEmail(mixed.toLowerCase());
    check(foundMixed?.id === dora.id, "adaptateur getUserByEmail : retrouve le compte à casse mixte");

    // Mot de passe oublié : le jeton vise l'adresse enregistrée, même à casse mixte.
    const token = `jeton-${run}-${randomBytes(8).toString("hex")}`;
    await prisma.verificationToken.create({
      data: { identifier: mixed, token: createHash("sha256").update(token).digest("hex"), expires: new Date(Date.now() + 60_000) },
    });
    check((await resetPassword(token, "nouveau-mdp-de-dora")) === "ok", "resetPassword : jeton d'une adresse à casse mixte accepté");
    check((await credentialsLogin(BASE_URL, mixed, "nouveau-mdp-de-dora"))?.id === dora.id, "le nouveau mot de passe fonctionne");
  }

  console.log("Invariants");
  {
    check((await prisma.user.count({ where: { email: outsider } })) === 0, "l'adresse hors liste n'a jamais obtenu de compte");
    check((await prisma.user.count({ where: { email: { startsWith: "inconnu" } } })) === 0, "aucune adresse inconnue n'a obtenu de compte");
  }
}

main()
  .catch((error) => {
    failures++;
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${checks - failures}/${checks} vérifications réussies`);
    process.exit(failures ? 1 : 0);
  });
