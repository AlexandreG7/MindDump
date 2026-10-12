/**
 * Test des adresses autorisées à s'inscrire sans lien (table AllowedSignupEmail,
 * src/lib/signupAllowlist.ts, e-mails src/lib/email.ts) : MindDump est en bêta privée,
 * personne hors de cette table (ni invitation : tests/beta.test.mjs, tests/group-invite.test.mjs)
 * ne peut créer de compte, mais les comptes existants se connectent et lient un fournisseur comme
 * avant (ADR 0001 : rien ne disparaît pour son auteur). Gérée dans /admin : routes
 * /api/admin/allowed-emails (administrateur, même origine, 409 doublon, 400 invalide).
 *
 * Un serveur MindDump sur une base JETABLE (scripts/test-signup.sh), table vide au départ.
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

const run = process.env.SIGNUP_TEST_RUN_ID || randomBytes(4).toString("hex");
process.env.NODE_ENV = "development";
process.env.OAUTH_TEST_ISSUER = "http://localhost:4010";

const unwrap = (mod) => ({ ...mod.default, ...mod });
const { isSignupAllowed, addAllowedEmail, removeAllowedEmail, listAllowedEmails } = unwrap(await import("../src/lib/signupAllowlist.ts"));
const { deleteUserAccount } = unwrap(await import("../src/lib/account.ts"));
const { createUserWithGrant } = unwrap(await import("../src/lib/signupInvite.ts"));
const { rateLimit, rateLimitAllows, rateLimitFail, ipKey, clientIp, MAX_KEYS } = unwrap(await import("../src/lib/rateLimit.ts"));
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
/** Ajoute / retire une adresse directement en base (semis du test ; les routes admin ont leur section). */
const allow = (address) => {
  const normalized = address.trim().toLowerCase();
  return prisma.allowedSignupEmail.upsert({ where: { email: normalized }, create: { email: normalized }, update: {} });
};
const disallow = (address) => prisma.allowedSignupEmail.deleteMany({ where: { email: address.trim().toLowerCase() } });
const inTable = async (address) => !!(await prisma.allowedSignupEmail.findUnique({ where: { email: address.trim().toLowerCase() } }));
/** Table vidée le temps de `fn`, puis restaurée. */
async function withEmptyTable(fn) {
  const saved = await prisma.allowedSignupEmail.findMany();
  await prisma.allowedSignupEmail.deleteMany();
  try {
    return await fn();
  } finally {
    await prisma.allowedSignupEmail.createMany({ data: saved });
  }
}

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

/** Tentative de connexion brute : `session` (cookie) si elle réussit, sinon l'URL d'erreur de NextAuth. */
async function loginAttempt(base, email, password, ip) {
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie, ...(ip ? { "x-forwarded-for": ip } : {}) },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }).toString(),
  });
  const session = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.includes("next-auth.session-token="));
  const body = await res.json().catch(() => null);
  return { session: session ?? null, url: body?.url ?? "", limited: String(body?.url ?? "").includes("TooManyAttempts") };
}

/** Inscription refusée (hors liste) depuis une adresse donnée : sert à compter les essais d'une IP. */
const post6 = (ip) =>
  fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ name: "T", email: `v6-${run}@test.local`, password: "motdepasse-solide", consent: true }),
  });

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const oauthAccount = (providerAccountId) => ({ provider: "test-oidc", type: "oauth", providerAccountId });
// `emailVerified` : valeur de `email_verified` du profil du fournisseur (A4).
const signInCallback = (options, email, providerAccountId = `sub-${randomBytes(4).toString("hex")}`, emailVerified = true) =>
  options.callbacks.signIn({
    user: { id: providerAccountId, email, name: "Test" },
    account: oauthAccount(providerAccountId),
    profile: emailVerified === "absent" ? { email } : { email, email_verified: emailVerified },
  });

/** Connexion e-mail / mot de passe : renvoie l'en-tête Cookie de la session (administrateur ou non). */
async function sessionCookie(base, email, password) {
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }).toString(),
  });
  const session = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.includes("next-auth.session-token="));
  return session ? [csrfCookie, session].join("; ") : null;
}
const adminApi = (method, path, cookie, body, headers = {}) =>
  fetch(`${BASE_URL}/api/admin/allowed-emails${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

async function main() {
  const outsider = `eve-${run}@test.local`;
  const existingOutsider = `carol-${run}@test.local`;

  console.log("Helper isSignupAllowed (table AllowedSignupEmail)");
  {
    check((await prisma.allowedSignupEmail.count()) === 0, "la table démarre vide : aucune adresse dans le code ni la migration");
    check(!(await isSignupAllowed(`alice-${run}@test.local`)), "table vide : fermé par défaut");
    // Semis : comme si l'administrateur avait ajouté ces adresses.
    for (const label of ["alice", "bob", "kelly"]) await allow(`${label}-${run}@test.local`);
    check(await isSignupAllowed(`alice-${run}@test.local`), "adresse de la table (minuscules)");
    check(await isSignupAllowed(`  ALICE-${run}@TEST.LOCAL  `), "casse et espaces variés acceptés");
    check(await isSignupAllowed(`BOB-${run}@test.local`), "deuxième adresse");
    check(!(await isSignupAllowed(outsider)), "adresse hors table refusée");
    check(!(await isSignupAllowed(`alice-${run}@test.local.evil.com`)) && !(await isSignupAllowed(`xalice-${run}@test.local`)), "pas de correspondance partielle");
    check(!(await isSignupAllowed("")) && !(await isSignupAllowed("   ")) && !(await isSignupAllowed(null)) && !(await isSignupAllowed(undefined)) && !(await isSignupAllowed(42)), "vide, blanc, null, nombre : refusés");
    check(!(await isSignupAllowed("%@test.local")) && !(await isSignupAllowed(`alice-${run}@test.%`)), "jokers LIKE : sans effet (égalité stricte)");
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
    check(!(await isSignupAllowed("\u212Aelly-" + run + "@test.local")) && (await isSignupAllowed(`kelly-${run}@test.local`)), "table : « K » ASCII accepté, Kelvin refusé");
  }

  console.log("Ajout à la table : normalisation et ASCII strict");
  {
    const added = await addAllowedEmail("  NORM-" + run + "@Test.Local ", " une note ", null);
    check(added.ok && added.entry.email === `norm-${run}@test.local` && added.entry.note === "une note", "ajout : adresse normalisée (casse, espaces), note rognée");
    check((await addAllowedEmail(`norm-${run}@TEST.local`, "", null)).reason === "duplicate", "même adresse, autre casse : doublon");
    check((await addAllowedEmail("\u212Aelly2-" + run + "@test.local", "", null)).reason === "invalid", "signe Kelvin refusé à l'ajout");
    check((await addAllowedEmail("é@test.local", "", null)).reason === "invalid" && (await addAllowedEmail("pas une adresse", "", null)).reason === "invalid" && (await addAllowedEmail(42, "", null)).reason === "invalid", "hors ASCII, mal formée, non textuelle : invalide");
    check((await addAllowedEmail(`long-${run}@test.local`, "x".repeat(121), null)).reason === "note-too-long", "note trop longue refusée");
    check((await listAllowedEmails()).some((e) => e.email === `norm-${run}@test.local`), "liste : l'adresse ajoutée apparaît");
    await disallow(`norm-${run}@test.local`);
  }

  console.log("Inscription e-mail / mot de passe (adresses autorisées)");
  const carolPassword = "mot-de-passe-de-carol";
  await prisma.user.create({
    data: { name: "Carol", email: existingOutsider, password: hashPassword(carolPassword), consentedAt: new Date() },
  });
  {
    const before = await countUsers();
    const refused = await register(BASE_URL, outsider);
    check(refused.status === 403, "hors table : 403");
    check(refused.body?.error === CLOSED_MESSAGE, "message en français, générique");
    check(!JSON.stringify(refused.body).includes(`alice-${run}`), "le message ne révèle rien de la liste");
    check(!(await userByEmail(outsider)) && (await countUsers()) === before, "aucun utilisateur créé hors table");

    const accepted = await register(BASE_URL, `ALICE-${run}@Test.Local`);
    check(accepted.status === 201, "dans la table (autre casse) : 201");
    const alice = await userByEmail(`alice-${run}@test.local`);
    check(!!alice, "utilisateur créé, adresse stockée en minuscules");
    check(!(await userByEmail(`ALICE-${run}@Test.Local`)), "pas de variante à casse mixte en base");
    check(!!alice && (await prisma.group.count({ where: { ownerId: alice.id, isDefault: true } })) === 1, "groupe par défaut créé");
    const aliceLogin = await credentialsLogin(BASE_URL, `ALICE-${run}@Test.Local`, "motdepasse-solide");
    check(aliceLogin?.id === alice?.id, "le compte inscrit se connecte");

    const again = await register(BASE_URL, `bob-${run}@test.local`, { password: "court" });
    check(again.status === 400, "dans la table mais mot de passe trop court : 400 habituel, rien de créé");
    check(!(await userByEmail(`bob-${run}@test.local`)), "bob n'a pas été créé");

    const dup = await register(BASE_URL, `ALICE-${run}@Test.Local`);
    check(dup.status === 409, "adresse autorisée déjà inscrite : 409 habituel");
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

  console.log("Pas d'énumération (hors table : inconnu ou déjà inscrit)");
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

  console.log("Connexion d'un compte existant hors table");
  {
    const carol = await credentialsLogin(BASE_URL, existingOutsider, carolPassword);
    check(!!carol?.email && carol.email === existingOutsider, "carol (hors table) se connecte");
    const wrong = await credentialsLogin(BASE_URL, existingOutsider, "mauvais");
    check(wrong === null, "mauvais mot de passe : toujours refusé");
  }

  console.log("Adresse retirée de la table : fermé, comptes intacts (ADR 0001)");
  {
    const zed = `zed-${run}@test.local`;
    await allow(zed);
    await disallow(zed);
    const before = await countUsers();
    const r = await register(BASE_URL, zed);
    check(r.status === 403 && r.body?.error === CLOSED_MESSAGE, "adresse ajoutée puis retirée : 403 générique");
    // Table entièrement vidée : même une adresse de l'ancienne liste est refusée.
    await withEmptyTable(async () => {
      const again = await register(BASE_URL, `bob-${run}@test.local`);
      check(again.status === 403 && again.body?.error === CLOSED_MESSAGE, "table vide : même une adresse précédemment autorisée : 403");
      check((await countUsers()) === before, "aucun utilisateur créé");
      const carol = await credentialsLogin(BASE_URL, existingOutsider, carolPassword);
      check(carol?.email === existingOutsider, "carol se connecte même quand tout est fermé");
      const alice = await credentialsLogin(BASE_URL, `ALICE-${run}@Test.Local`, "motdepasse-solide");
      check(!!alice, "un compte créé quand c'était ouvert se connecte toujours (son adresse n'est plus dans la table)");
      const aliceUser = await userByEmail(`alice-${run}@test.local`);
      check(!!aliceUser && (await prisma.group.count({ where: { ownerId: aliceUser.id, isDefault: true } })) === 1, "alice garde son compte et son groupe par défaut");
    });
    // createUserWithGrant, sous verrou : le chemin unique refuse aussi (adresse retirée, aucun jeton).
    const direct = await createUserWithGrant(zed, { name: "Zed" });
    check(direct.ok === false && direct.reason === "closed" && !(await userByEmail(zed)), "createUserWithGrant : adresse retirée = fermé, rien créé");
  }

  console.log("Pages /register et /login");
  {
    const open = await (await fetch(`${BASE_URL}/register`)).text();
    check(open.includes("Demander un accès à la bêta") && !open.includes("Créer mon compte"), "/register sans jeton : demande d'accès, pas de formulaire d'inscription");
    check(open.includes("Tu es déjà autorisé") && open.includes("/register?direct=1"), "/register : lien « Tu es déjà autorisé·e ? Crée ton compte »");
    const direct = await (await fetch(`${BASE_URL}/register?direct=1`)).text();
    check(direct.includes("Créer mon compte") && !direct.includes("Envoyer ma demande"), "/register?direct=1 : formulaire d'inscription");
    check(!direct.includes(`alice-${run}`) && !direct.includes(`bob-${run}`), "la page directe ne révèle aucune adresse de la table");
    const loginOpen = await (await fetch(`${BASE_URL}/login`)).text();
    check(loginOpen.includes("Demander un accès") && !loginOpen.includes("Créer un compte"), "/login : le lien devient « Demander un accès »");
    check(oauthErrorMessage("SignupClosed") === CLOSED_MESSAGE, "/login?error=SignupClosed : message en français");
  }

  console.log("OAuth (fournisseur test-oidc) : nouvel utilisateur");
  {
    check(authOptions.providers.some((p) => p.id === "test-oidc"), "le fournisseur test-oidc est actif dans ce processus");
    check(SIGNUP_CLOSED_URL === "/login?error=SignupClosed", "refus renvoyé vers /login?error=SignupClosed");
    const before = await countUsers();
    check((await signInCallback(authOptions, outsider)) === SIGNUP_CLOSED_URL, "nouvel utilisateur hors table : redirigé vers /login?error=SignupClosed");
    check((await signInCallback(authOptions, null)) === SIGNUP_CLOSED_URL, "profil sans e-mail : refusé");
    check((await signInCallback(authOptions, `BOB-${run}@Test.Local`)) === true, "nouvel utilisateur dans la table (autre casse) : accepté");
    check((await signInCallback(authOptions, `bob-${run}@test.local`, undefined, false)) === SIGNUP_CLOSED_URL, "A4 : email_verified=false, même dans la table : refusé");
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
    check(refused && !(await userByEmail(outsider)), "adaptateur createUser : refuse hors table, rien en base");
    const created = await authOptions.adapter.createUser({ email: `bob-${run}@test.local`, name: "Bob", emailVerified: null });
    check(!!created?.id && !!(await userByEmail(`bob-${run}@test.local`)), "adaptateur createUser : crée dans la table");
    // Adresse retirée : le callback relit la base, plus d'inscription OAuth.
    await allow(`zoe-${run}@test.local`);
    check((await signInCallback(authOptions, `zoe-${run}@test.local`)) === true, "adresse ajoutée à la table : OAuth accepté aussitôt (lecture en base)");
    await disallow(`zoe-${run}@test.local`);
    check((await signInCallback(authOptions, `ZOE-${run}@test.local`)) === SIGNUP_CLOSED_URL, "adresse retirée : OAuth refusé aussitôt");
    await allow(`yan-${run}@test.local`);
    await withEmptyTable(async () => {
      check((await signInCallback(authOptions, `yan-${run}@test.local`)) === SIGNUP_CLOSED_URL, "table vide : tout nouvel utilisateur OAuth refusé");
    });
  }

  console.log("OAuth : utilisateur existant et liaison (hors table)");
  {
    const carol = await userByEmail(existingOutsider);
    // 1. Compte OAuth déjà lié : connexion d'un utilisateur existant, même hors table, même table vide.
    const sub = `linked-${run}`;
    await prisma.account.create({
      data: { userId: carol.id, type: "oauth", provider: "test-oidc", providerAccountId: sub, access_token: "x" },
    });
    const savedRows = await prisma.allowedSignupEmail.findMany();
    await prisma.allowedSignupEmail.deleteMany();
    check((await signInCallback(authOptions, `autre-adresse-${run}@test.local`, sub)) === true, "compte OAuth déjà lié (e-mail du fournisseur différent) : connexion OK, table vide");
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
      check(result === true, `liaison ${label} à un compte hors table (table vide) : acceptée`);
      const user = await link.adapter.createUser({ email: `quelquun-${run}@ailleurs.test`, emailVerified: null });
      check(user.id === carol.id, `liaison ${label} : « createUser » rend l'utilisateur existant`);
    }
    check((await countUsers()) === before, "la liaison ne crée aucun utilisateur");
    check((await prisma.user.findUnique({ where: { id: carol.id } }))?.email === existingOutsider, "carol est intacte");
    await prisma.allowedSignupEmail.createMany({ data: savedRows });
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

  console.log("F2 : limiteur (IPv6 /64, éviction)");
  {
    const a = "2001:db8:1:2:aaaa:bbbb:cccc:dddd";
    const b = "2001:DB8:1:2:1111:2222:3333:4444";
    check(ipKey(a) === ipKey(b) && ipKey(a) === "2001:0db8:0001:0002::/64", `IPv6 : même /64 = même clé (${ipKey(a)})`);
    check(ipKey("2001:db8:1:3::1") !== ipKey(a), "IPv6 : un autre /64 a sa propre clé");
    check(ipKey("2001:db8::1") === "2001:0db8:0000:0000::/64" && ipKey("::1") === "0000:0000:0000:0000::/64", "IPv6 compressée (::) développée");
    check(ipKey("[2001:db8:1:2::9]") === ipKey(a) && ipKey("fe80::1%eth0") === ipKey("fe80::2"), "crochets et zone retirés");
    check(ipKey("::ffff:203.0.113.5") === "203.0.113.5" && ipKey("203.0.113.5") === "203.0.113.5", "IPv4 (et IPv4 mappée) : inchangée");
    check(ipKey("n'importe quoi") === "n'importe quoi" && ipKey("1:2:3") === "1:2:3", "valeur illisible : telle quelle");
    check(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 2001:db8:1:2::5" })) === clientIp(new Headers({ "x-forwarded-for": "2001:db8:1:2:ffff::6" })), "clientIp : deux adresses d'un même /64, même seau");
    const v6 = [];
    for (let i = 0; i < 12; i++) v6.push((await post6(`2001:db8:77:5:${i + 1}::${i + 1}`)).status);
    check(v6.slice(0, 10).every((st) => st === 403) && v6[10] === 429 && v6[11] === 429, `inscription : les adresses d'un même /64 partagent le seau (${v6.join(",")})`);

    // Éviction : table pleine, les plus anciennes disparaissent, les récentes gardent leur compteur.
    const T = 1_000_000_000_000;
    const W = 1_000_000_000;
    rateLimit("ev-cold", 1, W, T);
    check(!rateLimit("ev-cold", 1, W, T), "ev-cold : bloquée avant la saturation");
    for (let i = 0; i < MAX_KEYS; i++) rateLimit(`ev-fill-${i}`, 1, W, T);
    rateLimit("ev-hot", 1, W, T);
    check(!rateLimit("ev-hot", 1, W, T), "ev-hot : bloquée, insérée table pleine");
    for (let i = 0; i < 200; i++) rateLimit(`ev-more-${i}`, 1, W, T);
    check(!rateLimit("ev-hot", 1, W, T), "saturation : l'entrée récente garde son compteur (pas de clear())");
    check(rateLimit("ev-cold", 1, W, T), "saturation : l'entrée la plus ancienne a été évincée");
    // Compteur d'échecs de connexion.
    for (let i = 0; i < 9; i++) rateLimitFail("lf", 1000, T);
    const nine = rateLimitAllows("lf", 10, T);
    rateLimitFail("lf", 1000, T);
    check(nine && !rateLimitAllows("lf", 10, T) && rateLimitAllows("lf", 10, T + 1001), "échecs : bloqué au 10e, libéré à l'expiration de la fenêtre");
  }

  console.log("F2 : limite de débit sur la connexion par mot de passe");
  {
    const pw = (label) => `mdp-${label}-solide`;
    const mk = async (label) => {
      const address = `login-${label}-${run}@test.local`;
      await prisma.user.create({ data: { name: label, email: address, password: hashPassword(pw(label)), consentedAt: new Date() } });
      return address;
    };

    // Par e-mail : 10 échecs depuis 10 IP différentes bloquent la 11e tentative, même juste.
    const victim = await mk("victime");
    for (let i = 0; i < 10; i++) await loginAttempt(BASE_URL, victim, "mauvais", freshIp());
    const blockedEmail = await loginAttempt(BASE_URL, victim, pw("victime"), freshIp());
    check(!blockedEmail.session && blockedEmail.limited, "10 échecs sur une adresse : la 11e tentative est refusée (autre IP, bon mot de passe)");
    const unknownBlocked = await loginAttempt(BASE_URL, `inconnu-${run}@test.local`, "x", freshIp());
    check(!unknownBlocked.limited, "une adresse sans compte n'est pas bloquée tant que ses propres échecs sont peu nombreux");
    for (let i = 0; i < 10; i++) await loginAttempt(BASE_URL, `fantome-${run}@test.local`, "x", freshIp());
    const ghost = await loginAttempt(BASE_URL, `fantome-${run}@test.local`, "x", freshIp());
    check(ghost.limited, "adresse inexistante après 10 échecs : même refus que pour un compte (pas d'énumération)")
    check(ghost.url.split("error=")[1] === blockedEmail.url.split("error=")[1], "…avec exactement le même code d'erreur");

    // Par IP : 10 échecs sur 10 adresses différentes bloquent cette IP.
    const bystander = await mk("passant");
    const ip = "203.0.113.50";
    for (let i = 0; i < 10; i++) await loginAttempt(BASE_URL, `devine-${i}-${run}@test.local`, "x", ip);
    const blockedIp = await loginAttempt(BASE_URL, bystander, pw("passant"), ip);
    check(!blockedIp.session && blockedIp.limited, "10 échecs depuis une IP : elle est bloquée, même avec un bon mot de passe");
    const otherIp = await loginAttempt(BASE_URL, bystander, pw("passant"), freshIp());
    check(!!otherIp.session, "une autre IP n'est pas touchée");

    // Non-régression : les connexions réussies ne comptent pas.
    const regular = await mk("habituee");
    const results = [];
    for (let i = 0; i < 13; i++) results.push((await loginAttempt(BASE_URL, regular, pw("habituee"), "203.0.113.60")).session !== null);
    check(results.every(Boolean), "un compte existant se connecte toujours : 13 connexions réussies d'affilée depuis la même IP");
    await loginAttempt(BASE_URL, regular, "faute-de-frappe", "203.0.113.60");
    check((await loginAttempt(BASE_URL, regular, pw("habituee"), "203.0.113.60")).session !== null, "une faute de frappe puis le bon mot de passe : connexion");
    check((await loginAttempt(BASE_URL, existingOutsider, carolPassword, freshIp())).session !== null, "carol (hors table) se connecte toujours");
  }

  console.log("F4 : /register?invite= jamais mis en cache");
  {
    const withInvite = await fetch(`${BASE_URL}/register?invite=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
    check((withInvite.headers.get("cache-control") || "").includes("no-store"), `/register?invite= : Cache-Control no-store (${withInvite.headers.get("cache-control")})`);
    const sw = (await import("node:fs")).readFileSync(new URL("../src/app/sw.ts", import.meta.url), "utf8");
    check(/const isPage = [^\n]*startsWith\("\/register"\)/.test(sw), "service worker : /register exclu du cache de navigation");
  }

  console.log("Administration : /api/admin/allowed-emails");
  {
    const adminPw = "mdp-admin-allowlist";
    const simplePw = "mdp-simple-allowlist";
    await prisma.user.create({ data: { name: "Admin", email: `admin-allow-${run}@test.local`, password: hashPassword(adminPw), role: "admin", consentedAt: new Date() } });
    await prisma.user.create({ data: { name: "Simple", email: `simple-allow-${run}@test.local`, password: hashPassword(simplePw), role: "user", consentedAt: new Date() } });
    const adminCookie = await sessionCookie(BASE_URL, `admin-allow-${run}@test.local`, adminPw);
    const userCookie = await sessionCookie(BASE_URL, `simple-allow-${run}@test.local`, simplePw);
    check(!!adminCookie && !!userCookie, "sessions de test (administrateur, utilisateur simple)");
    const target = `Nina-${run}@Test.Local`;
    const norm = `nina-${run}@test.local`;
    const rowCount = () => prisma.allowedSignupEmail.count();

    // Accès : sans session 401, utilisateur simple 403, sur les trois verbes.
    const before = await rowCount();
    const anon = [await adminApi("GET", ""), await adminApi("POST", "", undefined, { email: target }), await adminApi("DELETE", "/x", undefined)];
    check(anon.every((r) => r.status === 401), `sans session : 401 partout (${anon.map((r) => r.status).join(",")})`);
    const plain = [await adminApi("GET", "", userCookie), await adminApi("POST", "", userCookie, { email: target }), await adminApi("DELETE", "/x", userCookie)];
    check(plain.every((r) => r.status === 403), `non-administrateur : 403 partout (${plain.map((r) => r.status).join(",")})`);
    check((await rowCount()) === before && !(await inTable(norm)), "…et rien n'a été ajouté");

    // Origine étrangère : 403 même pour l'administrateur, rien ne change.
    const evil = { origin: "https://evil.example" };
    check((await adminApi("POST", "", adminCookie, { email: target }, evil)).status === 403 && !(await inTable(norm)), "POST depuis une origine étrangère : 403, rien ajouté");
    const ok = await adminApi("POST", "", adminCookie, { email: `  ${target}  `, note: "  amie  " });
    const created = await ok.json();
    check(ok.status === 201 && created.email === norm && created.note === "amie", `ajout par l'administrateur : 201, adresse normalisée (${ok.status})`);
    check(await inTable(`  ${target.toUpperCase()} `), "…variantes de casse et d'espaces retrouvées");
    const row = await prisma.allowedSignupEmail.findUnique({ where: { email: norm } });
    check(!!row?.createdById && !!row.createdAt, "ajouteur et date enregistrés");
    const list = await (await adminApi("GET", "", adminCookie)).json();
    check(list.emails.some((e) => e.id === created.id && e.email === norm), "GET : l'adresse est listée");
    check((await adminApi("DELETE", `/${created.id}`, adminCookie, undefined, evil)).status === 403 && (await inTable(norm)), "DELETE depuis une origine étrangère : 403, l'adresse reste");

    // Doublon et saisies invalides.
    check((await adminApi("POST", "", adminCookie, { email: `NINA-${run}@test.local` })).status === 409, "doublon (autre casse) : 409");
    for (const [label, body] of [["mal formée", { email: "pas-une-adresse" }], ["vide", { email: "  " }], ["absente", {}], ["non textuelle", { email: 42 }], ["Kelvin", { email: `\u212Aelly-${run}@test.local` }], ["hors ASCII", { email: "é@test.local" }], ["note trop longue", { email: `n2-${run}@test.local`, note: "x".repeat(200) }]]) {
      check((await adminApi("POST", "", adminCookie, body)).status === 400, `saisie ${label} : 400`);
    }
    check((await fetch(`${BASE_URL}/api/admin/allowed-emails`, { method: "POST", headers: { cookie: adminCookie }, body: "pas du json" })).status === 400, "corps illisible : 400");
    check((await rowCount()) === before + 1, "les saisies refusées n'ont rien ajouté");

    // Inscription directe : mot de passe, puis OAuth, pour une adresse ajoutée.
    const reg = await register(BASE_URL, norm.toUpperCase());
    check(reg.status === 201, `adresse ajoutée : inscription directe par mot de passe (${reg.status})`);
    const ninaUser = await userByEmail(norm);
    check(!!ninaUser, "compte créé, adresse en minuscules");
    const ninaLogin = await credentialsLogin(BASE_URL, norm, "motdepasse-solide");
    check(ninaLogin?.id === ninaUser?.id, "…et il se connecte");
    const oauthAddr = `Oscar-${run}@Test.Local`;
    check((await signInCallback(authOptions, oauthAddr)) === SIGNUP_CLOSED_URL, "OAuth avant l'ajout : fermé");
    const oscar = await (await adminApi("POST", "", adminCookie, { email: oauthAddr })).json();
    check((await signInCallback(authOptions, oauthAddr)) === true, "OAuth test-oidc, email_verified=true, après l'ajout : accepté");
    check((await signInCallback(authOptions, oauthAddr, undefined, false)) === SIGNUP_CLOSED_URL, "OAuth avec email_verified=false : refusé même autorisée");
    const oscarUser = await authOptions.adapter.createUser({ email: oauthAddr, name: "Oscar", emailVerified: null });
    check(!!oscarUser?.id && !!(await userByEmail(oauthAddr.toLowerCase())), "OAuth : l'adaptateur crée le compte (adresse en minuscules)");

    // Retrait : fermé pour un nouveau compte, compte existant intact (ADR 0001).
    const ninaGroups = await prisma.groupMember.count({ where: { userId: ninaUser.id } });
    const del = await adminApi("DELETE", `/${created.id}`, adminCookie);
    check(del.status === 200 && !(await inTable(norm)), "retrait par l'administrateur : 200, adresse sortie de la table");
    check((await adminApi("DELETE", `/${created.id}`, adminCookie)).status === 404, "retrait d'une adresse déjà retirée : 404");
    check((await userByEmail(norm)) !== null && (await credentialsLogin(BASE_URL, norm, "motdepasse-solide"))?.id === ninaUser.id, "ADR 0001 : le compte de l'adresse retirée existe et se connecte toujours");
    check((await prisma.groupMember.count({ where: { userId: ninaUser.id } })) === ninaGroups && ninaGroups >= 1, "…ses groupes (et donc ses éléments) sont intacts");
    const oscarBefore = await oscarUser.id;
    await adminApi("DELETE", `/${oscar.id}`, adminCookie);
    check(!!(await prisma.user.findUnique({ where: { id: oscarBefore } })), "compte OAuth conservé aussi après retrait de son adresse");
    check((await register(BASE_URL, `Newbie-${run}@Test.Local`)).status === 403, "adresse jamais ajoutée : 403 générique");
    const gone = await register(BASE_URL, `nina2-${run}@test.local`);
    check(gone.status === 403 && gone.body?.error === CLOSED_MESSAGE, "adresse retirée avant inscription : même 403 générique");

    // Pas d'énumération : adresse retirée (compte existant ou non) = même réponse.
    const existingRemoved = await register(BASE_URL, norm);
    const neverAllowed = await register(BASE_URL, `jamais-${run}@test.local`);
    check(existingRemoved.status === 403 && neverAllowed.status === 403 && JSON.stringify(existingRemoved.body) === JSON.stringify(neverAllowed.body), "adresse retirée avec compte / jamais autorisée sans compte : même 403, même corps");

    // Course : retrait pendant l'inscription. L'utilisateur existe si et seulement si l'inscription a réussi.
    for (let i = 0; i < 4; i++) {
      const racer = `racer-${i}-${run}@test.local`;
      const entry = await (await adminApi("POST", "", adminCookie, { email: racer })).json();
      const [r, d] = await Promise.all([register(BASE_URL, racer), adminApi("DELETE", `/${entry.id}`, adminCookie)]);
      const exists = !!(await userByEmail(racer));
      check(d.status === 200 && [201, 403].includes(r.status) && exists === (r.status === 201), `course ${i} : inscription ${r.status} / retrait ${d.status}, compte ${exists ? "créé" : "absent"} (cohérent)`);
    }

    // RGPD : la suppression d'un compte retire aussi son adresse de la table.
    const leaver = `partant-${run}@test.local`;
    const other = `reste-${run}@test.local`;
    await allow(leaver);
    await allow(other);
    check((await register(BASE_URL, `PARTANT-${run}@test.local`)).status === 201, "inscription directe du futur partant");
    const leaverUser = await userByEmail(leaver);
    check(await deleteUserAccount(leaverUser.id, { keepShared: true }), "suppression du compte");
    check(!(await inTable(leaver)) && (await inTable(other)), "RGPD : son adresse est retirée de la table, celles des autres restent");
    check((await register(BASE_URL, leaver)).status === 403, "après suppression de compte : l'adresse ne peut plus se réinscrire sans nouvelle autorisation");

    // Suppression de l'administrateur qui a ajouté : l'adresse reste (createdById -> NULL).
    const keeper = await prisma.user.create({ data: { name: "Ajouteur", email: `ajouteur-${run}@test.local`, password: hashPassword("x-ajouteur-1"), role: "admin", consentedAt: new Date() } });
    await prisma.allowedSignupEmail.create({ data: { email: `ajoutee-${run}@test.local`, createdById: keeper.id } });
    await deleteUserAccount(keeper.id, { keepShared: true });
    const orphan = await prisma.allowedSignupEmail.findUnique({ where: { email: `ajoutee-${run}@test.local` } });
    check(!!orphan && orphan.createdById === null, "compte de l'ajouteur supprimé : l'adresse reste, createdById passe à NULL");
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
