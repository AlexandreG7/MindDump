/**
 * Test de la liste blanche d'inscription (src/lib/signupAllowlist.ts) :
 * MindDump est privé jusqu'à la V1, personne hors ALLOWED_SIGNUP_EMAILS ne peut
 * créer de compte, mais les comptes existants se connectent et lient un
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
const LIST = ` ALICE-${run}@Test.Local , bob-${run}@test.local ,, `;
// Le processus de test lit la même liste que le serveur A pour les callbacks directs.
process.env.ALLOWED_SIGNUP_EMAILS = LIST;
process.env.NODE_ENV = "development";
process.env.OAUTH_TEST_ISSUER = "http://localhost:4010";

const unwrap = (mod) => ({ ...mod.default, ...mod });
const { isSignupAllowed, isSignupOpen } = unwrap(await import("../src/lib/signupAllowlist.ts"));
const { authOptions, SIGNUP_CLOSED_URL } = unwrap(await import("../src/lib/auth.ts"));
const { linkAuthOptions } = unwrap(await import("../src/lib/accountLinking.ts"));
const { hashPassword } = unwrap(await import("../src/lib/password.ts"));
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

async function register(base, email, extra = {}) {
  const started = performance.now();
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
const signInCallback = (options, email, providerAccountId = `sub-${randomBytes(4).toString("hex")}`) =>
  options.callbacks.signIn({
    user: { id: providerAccountId, email, name: "Test" },
    account: oauthAccount(providerAccountId),
    profile: { email },
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
    const alice = await userByEmail(`ALICE-${run}@Test.Local`);
    check(!!alice, "utilisateur créé");
    check(!!alice && (await prisma.group.count({ where: { ownerId: alice.id, isDefault: true } })) === 1, "groupe par défaut créé");
    const aliceLogin = await credentialsLogin(BASE_URL, `ALICE-${run}@Test.Local`, "motdepasse-solide");
    check(aliceLogin?.id === alice?.id, "le compte inscrit se connecte");

    const again = await register(BASE_URL, `bob-${run}@test.local`, { password: "court" });
    check(again.status === 400, "dans la liste mais mot de passe trop court : 400 habituel, rien de créé");
    check(!(await userByEmail(`bob-${run}@test.local`)), "bob n'a pas été créé");

    const dup = await register(BASE_URL, `ALICE-${run}@Test.Local`);
    check(dup.status === 409, "adresse de la liste déjà inscrite : 409 habituel");
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
    check(open.includes("Créer mon compte") && !open.includes(CLOSED_MESSAGE), "liste renseignée : /register affiche le formulaire");
    const closed = await (await fetch(`${CLOSED_URL}/register`)).text();
    check(closed.includes(CLOSED_MESSAGE) && !closed.includes("Créer mon compte"), "liste vide : /register affiche le message à la place du formulaire");
    const loginOpen = await (await fetch(`${BASE_URL}/login`)).text();
    const loginClosed = await (await fetch(`${CLOSED_URL}/login`)).text();
    check(loginOpen.includes("Créer un compte"), "liste renseignée : /login garde le lien « Créer un compte »");
    check(!loginClosed.includes("Créer un compte") && loginClosed.includes("Se connecter"), "liste vide : lien masqué, connexion intacte");
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
