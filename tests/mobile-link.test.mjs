/**
 * Liaison d'un compte Google/Apple depuis l'app mobile (src/lib/mobileLink.ts,
 * docs/oauth.md « Connexion depuis l'app mobile »). Modèle de menace couvert :
 *
 *  - un ticket est lié à l'utilisateur connecté au départ : celui d'un autre
 *    utilisateur, rejoué, expiré ou avec un mauvais PKCE ne lie rien ;
 *  - un compte OAuth déjà lié à quelqu'un d'autre n'est jamais déplacé (« taken ») ;
 *  - lier ne crée ni utilisateur, ni session, ni entrée d'historique de connexion ;
 *  - délier le dernier moyen de connexion est refusé.
 *
 * Par HTTP contre un serveur MindDump sur une base JETABLE (même principe que
 * tests/ownership.test.mjs), plus les options NextAuth de liaison appelées
 * directement. Le retour du fournisseur est simulé en écrivant l'Account en base :
 * le serveur de production n'active pas le fournisseur de test. Le parcours OAuth
 * complet (serveur OIDC local) est joué en plus si OAUTH_TEST_ISSUER est défini et
 * actif (serveur de dev, voir scripts/test-oidc-server.mjs).
 *
 * Lancer avec tsx (imports TypeScript) : npm run test:mobile-link
 * Variables : BASE_URL, DATABASE_URL (JAMAIS la prod), NEXTAUTH_SECRET (= celui du serveur).
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import { encode } from "next-auth/jwt";

// tsx charge ces modules TypeScript en CommonJS : les exports nommés passent par `default`.
const unwrap = (mod) => ({ ...mod.default, ...mod });
const { decodeLinkIntent, linkAuthOptions, LINK_COOKIE } = unwrap(await import("../src/lib/accountLinking.ts"));
const { authOptions } = unwrap(await import("../src/lib/auth.ts"));

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
if (process.env.OWNERSHIP_TEST_DB !== "disposable") {
  console.error("Refus : OWNERSHIP_TEST_DB=disposable requis (ce test écrit dans la base).");
  process.exit(2);
}

const prisma = new PrismaClient();
const run = randomBytes(4).toString("hex");
const APP_UA = "Mozilla/5.0 MindDumpApp/1";
let failures = 0;
let checks = 0;
const check = (cond, label) => {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
};

const sha256 = (v) => createHash("sha256").update(v).digest("base64url");
const newVerifier = () => randomBytes(48).toString("base64url");
const challengeOf = (verifier) => sha256(verifier);

async function makeUser(name, { password = null } = {}) {
  const user = await prisma.user.create({
    data: { name, email: `${name}-${run}@test.local`, password, consentedAt: new Date() },
  });
  const token = await encode({
    token: { sub: user.id, name, email: user.email, role: "user", consented: true },
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 3600,
  });
  return { id: user.id, email: user.email, cookie: `next-auth.session-token=${token}` };
}

async function http(method, path, { user, body, native = true, cookies = "", headers = {} } = {}) {
  const cookie = [user?.cookie, cookies].filter(Boolean).join("; ");
  return fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(native ? { "user-agent": APP_UA } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const setCookies = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]);
const cookieValue = (res, name) => {
  const hit = setCookies(res).find((c) => c.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
};

const PROVIDER = "google";
async function getTicket(user, verifier) {
  const res = await http("POST", "/api/mobile-auth/link-ticket", {
    user,
    body: { provider: PROVIDER, challenge: challengeOf(verifier) },
  });
  return { res, ticket: res.ok ? (await res.json()).ticket : null };
}
const startUrl = (ticket, extra = "") => `/api/mobile-auth/start?mode=link&ticket=${encodeURIComponent(ticket)}${extra}`;
/** Navigateur système : start puis complete ; renvoie le code (ou null) et les réponses. */
async function browserFlow(ticket, { status = "", simulate } = {}) {
  const start = await http("GET", startUrl(ticket), { native: false });
  if (start.status !== 307 && start.status !== 302) return { start, code: null };
  const pending = cookieValue(start, "minddump.mobile-auth");
  if (simulate) await simulate(start);
  const complete = await http("GET", `/api/mobile-auth/complete${status}`, {
    native: false,
    cookies: `minddump.mobile-auth=${pending}`,
  });
  const location = complete.headers.get("location") || "";
  const code = location.startsWith("minddump://auth") ? new URL(location).searchParams.get("code") : null;
  return { start, complete, code, location };
}
const exchange = (user, code, verifier) =>
  http("POST", "/api/mobile-auth/link-exchange", { user, body: { code, verifier } });

/**
 * Parcours OAuth complet avec le serveur OIDC local (scripts/test-oidc-server.mjs) :
 * rejoue ce que fait le navigateur système, cookies compris. Hors production seulement.
 */
async function oidcSuite({ alice, bob, mallory }) {
  console.log("Parcours OAuth complet (test-oidc, retour en form_post)");
  const issuer = process.env.OAUTH_TEST_ISSUER;
  const jar = new Map();
  const absorb = (res) => {
    for (const raw of res.headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      const gone = !value || attrs.some((a) => /max-age=0/i.test(a));
      if (gone) jar.delete(name);
      else jar.set(name, value);
    }
  };
  const jarHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const browse = async (method, url, { body, form } = {}) => {
    const res = await fetch(url.startsWith("http") ? url : BASE_URL + url, {
      method,
      redirect: "manual",
      headers: {
        cookie: jarHeader(),
        ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : body,
    });
    absorb(res);
    return res;
  };

  /** Le navigateur système, de /api/mobile-auth/start au retour minddump://. */
  async function systemBrowser(ticket, sub, { cookies = {}, email } = {}) {
    jar.clear();
    for (const [k, v] of Object.entries(cookies)) jar.set(k, v);
    await fetch(`${issuer}/__subject?sub=${sub}${email ? `&email=${encodeURIComponent(email)}` : ""}`);
    const start = await browse("GET", startUrl(ticket));
    const page = new URL(start.headers.get("location"), BASE_URL);
    const nonce = page.searchParams.get("li");
    // Ce que fait la page /auth/mobile : signIn(provider, { callbackUrl }).
    const csrf = await (await browse("GET", "/api/auth/csrf")).json();
    const signin = await browse("POST", "/api/auth/signin/test-oidc", {
      form: { csrfToken: csrf.csrfToken, callbackUrl: `/api/mobile-auth/complete?li=${nonce}`, json: "true" },
    });
    const authorizeUrl = (await signin.json()).url ?? signin.headers.get("location");
    const authorize = await browse("GET", `${authorizeUrl}&auto`);
    const html = await authorize.text();
    const action = html.match(/<form[^>]*action="([^"]+)"/)[1].replace(/&amp;/g, "&");
    const fields = Object.fromEntries([...html.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&amp;/g, "&")]));
    const callback = await browse("POST", action, { form: fields });
    const callbackCookies = callback.headers.getSetCookie();
    if (process.env.DEBUG_OIDC) console.log('callback', callback.status, callback.headers.get('location'), action, fields);
    let next = callback.headers.get("location");
    let hops = 0;
    let last = callback;
    while (next && !next.startsWith("minddump://") && hops++ < 5) {
      last = await browse("GET", new URL(next, BASE_URL).href);
      next = last.headers.get("location");
    }
    return {
      callbackCookies,
      location: next,
      code: next?.startsWith("minddump://") ? new URL(next).searchParams.get("code") : null,
    };
  }

  const sessionCookies = (flow) => flow.callbackCookies.filter((c) => c.includes("session-token=") && !/=;/.test(c));

  // 1. Lier : le compte arrive sur l'utilisateur du ticket (Alice a déjà google ; ici test-oidc),
  //    même si le navigateur système porte la session de quelqu'un d'autre (Mallory).
  const alicesOidc = `oidc-sub-${run}-a`;
  let v = newVerifier();
  let ticket = (await (await http("POST", "/api/mobile-auth/link-ticket", { user: alice, body: { provider: "test-oidc", challenge: challengeOf(v) } })).json()).ticket;
  const usersBefore = await prisma.user.count();
  const oidcEvents = await prisma.loginEvent.count({ where: { provider: "test-oidc" } });
  let flow = await systemBrowser(ticket, alicesOidc, { cookies: { "next-auth.session-token": mallory.cookie.split("=")[1] } });
  check(!!flow.code, "le retour du fournisseur aboutit à minddump://auth?code=…");
  check(sessionCookies(flow).length === 0, "le callback ne pose pas de cookie de session");
  let res = await exchange(alice, flow.code, v);
  check((await res.json()).result === "linked", "exchange : linked");
  const row = await prisma.account.findFirst({ where: { provider: "test-oidc", providerAccountId: alicesOidc } });
  check(row?.userId === alice.id, "le compte OAuth est rattaché à Alice (utilisateur du ticket)");
  check((await prisma.account.count({ where: { userId: mallory.id } })) === 0, "…et pas à Mallory, dont la session traînait dans le navigateur système");
  check((await prisma.user.count()) === usersBefore, "aucun utilisateur créé");
  check((await prisma.loginEvent.count({ where: { provider: "test-oidc" } })) === oidcEvents, "aucune connexion enregistrée");

  // 2. Compte déjà lié à Alice, demandé par Bob : taken, rien ne bouge.
  v = newVerifier();
  ticket = (await (await http("POST", "/api/mobile-auth/link-ticket", { user: bob, body: { provider: "test-oidc", challenge: challengeOf(v) } })).json()).ticket;
  const snapshot = JSON.stringify(await prisma.account.findMany({ orderBy: { id: "asc" } }));
  flow = await systemBrowser(ticket, alicesOidc);
  check(!!flow.code && sessionCookies(flow).length === 0, "taken : retour dans l'app, sans session");
  res = await exchange(bob, flow.code, v);
  check((await res.json()).result === "taken", "exchange : taken");
  check(JSON.stringify(await prisma.account.findMany({ orderBy: { id: "asc" } })) === snapshot, "aucun compte modifié");
  check((await prisma.user.count()) === usersBefore, "toujours aucun utilisateur créé");

  // 3. Un compte inconnu, e-mail déjà inscrit : jamais de liaison par e-mail.
  v = newVerifier();
  ticket = (await (await http("POST", "/api/mobile-auth/link-ticket", { user: bob, body: { provider: "test-oidc", challenge: challengeOf(v) } })).json()).ticket;
  const bobsSub = `oidc-sub-${run}-b`;
  flow = await systemBrowser(ticket, bobsSub, { email: alice.email });
  res = await exchange(bob, flow.code, v);
  const bobs = await prisma.account.findFirst({ where: { userId: bob.id, provider: "test-oidc" } });
  check((await res.json()).result === "linked" && !!bobs && bobs.providerAccountId === bobsSub, "Bob lie son compte fournisseur, même avec l'e-mail d'Alice : pas de liaison par e-mail");
  check((await prisma.account.count({ where: { userId: alice.id, provider: "test-oidc" } })) === 1, "Alice n'a que le sien");

  // 4. Flux web (navigateur) : inchangé, retour vers le profil, session conservée.
  const walt = await makeUser("walt");
  jar.clear();
  jar.set("next-auth.session-token", walt.cookie.split("=")[1]);
  const prep = await browse("POST", "/api/users/me/accounts", { body: JSON.stringify({ provider: "test-oidc" }) });
  const { nonce } = await prep.json();
  check(!!nonce && jar.has("minddump.link-intent"), "web : « Lier » pose l'intention (cookie + nonce)");
  await fetch(`${issuer}/__subject?sub=oidc-sub-${run}-w`);
  const wcsrf = await (await browse("GET", "/api/auth/csrf")).json();
  const wsignin = await browse("POST", "/api/auth/signin/test-oidc", {
    form: { csrfToken: wcsrf.csrfToken, callbackUrl: `/profile?link=ok&provider=test-oidc&li=${nonce}#connexion`, json: "true" },
  });
  const wauth = await browse("GET", `${(await wsignin.json()).url}&auto`);
  const whtml = await wauth.text();
  const waction = whtml.match(/<form[^>]*action="([^"]+)"/)[1].replace(/&amp;/g, "&");
  const wfields = Object.fromEntries([...whtml.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const wcb = await browse("POST", waction, { form: wfields });
  check((wcb.headers.get("location") || "").includes("/profile?link=ok"), "web : retour vers le profil");
  check((await prisma.account.count({ where: { userId: walt.id, provider: "test-oidc" } })) === 1, "web : compte lié à l'utilisateur connecté");
}

async function main() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const frank = await makeUser("frank");
  const mallory = await makeUser("mallory");
  const usersBefore = await prisma.user.count();
  const eventsBefore = await prisma.loginEvent.count();

  console.log("Ticket");
  {
    const v = newVerifier();
    check((await http("POST", "/api/mobile-auth/link-ticket", { body: { provider: PROVIDER, challenge: challengeOf(v) } })).status === 401, "sans session : refusé (401)");
    check((await http("POST", "/api/mobile-auth/link-ticket", { user: alice, native: false, body: { provider: PROVIDER, challenge: challengeOf(v) } })).status === 403, "hors de l'app : refusé (403)");
    check((await http("POST", "/api/mobile-auth/link-ticket", { user: alice, body: { provider: "inconnu", challenge: challengeOf(v) } })).status === 400, "fournisseur inconnu : refusé");
    check((await http("POST", "/api/mobile-auth/link-ticket", { user: alice, body: { provider: PROVIDER, challenge: "court" } })).status === 400, "défi PKCE invalide : refusé");
    const { res, ticket } = await getTicket(alice, v);
    check(res.ok && !!ticket, "utilisateur connecté dans l'app : ticket émis");
    const row = await prisma.mobileLinkTicket.findUnique({ where: { ticketHash: sha256(ticket) } });
    check(row?.userId === alice.id && row.provider === PROVIDER && row.challenge === challengeOf(v), "ticket lié à l'utilisateur, au fournisseur et au défi");
    check(!JSON.stringify(row).includes(ticket), "seul le SHA-256 du ticket est stocké");
    check(row.expiresAt.getTime() - Date.now() <= 5 * 60 * 1000 + 1000, "durée de vie du ticket : 5 minutes au plus");
  }

  console.log("Parcours nominal (lier Alice)");
  {
    const v = newVerifier();
    const { ticket } = await getTicket(alice, v);
    const sub = `sub-${run}-alice`;
    const flow = await browserFlow(ticket, {
      // Retour du fournisseur : NextAuth (options de liaison) rattache le compte à l'intention.
      simulate: async (start) => {
        const intent = await decodeLinkIntent(cookieValue(start, LINK_COOKIE));
        check(intent?.userId === alice.id && intent.provider === PROVIDER && !!intent.nonce && !!intent.ticketId, "start pose l'intention de liaison : utilisateur du TICKET, nonce, ticket");
        await prisma.account.create({
          data: { userId: intent.userId, type: "oauth", provider: PROVIDER, providerAccountId: sub },
        });
      },
    });
    check(!!flow.code, "complete renvoie minddump://auth?code=…");
    check(!setCookies(flow.complete).some((c) => c.includes("session-token=") && !c.endsWith("=")), "complete ne pose aucun cookie de session");
    check(!flow.location.includes("verifier"), "le retour n'expose pas de verifier");
    const res = await exchange(alice, flow.code, v);
    const data = await res.json();
    check(res.ok && data.result === "linked" && data.provider === PROVIDER, "exchange : linked");
    check(setCookies(res).length === 0, "exchange ne pose aucun cookie (pas de nouvelle session)");
    check((await exchange(alice, flow.code, v)).status === 400, "code rejoué : refusé");
    check((await http("POST", "/api/mobile-auth/link-ticket", { user: alice, body: { provider: PROVIDER, challenge: challengeOf(v) } })).status === 409, "déjà lié : nouveau ticket refusé (409)");
  }

  console.log("Ticket d'un autre utilisateur");
  {
    const v = newVerifier();
    const { ticket } = await getTicket(bob, v);
    const flow = await browserFlow(ticket, {
      simulate: async (start) => {
        const intent = await decodeLinkIntent(cookieValue(start, LINK_COOKIE));
        check(intent?.userId === bob.id, "l'intention suit le ticket de Bob");
        await prisma.account.create({
          data: { userId: intent.userId, type: "oauth", provider: PROVIDER, providerAccountId: `sub-${run}-bob` },
        });
      },
    });
    // La WebView d'Alice présente le code du ticket de Bob avec le bon verifier.
    const res = await exchange(alice, flow.code, v);
    check(res.status === 400, "session d'Alice + ticket de Bob : refusé");
    check((await prisma.account.count({ where: { userId: alice.id } })) === 1, "Alice n'a toujours qu'un compte lié");
    check((await exchange(bob, flow.code, v)).status === 400, "le code est brûlé même après un essai raté");
    check((await http("POST", "/api/mobile-auth/link-exchange", { body: { code: flow.code, verifier: v } })).status === 401, "exchange sans session : 401");
  }

  console.log("Paramètres d'URL ignorés");
  {
    const v = newVerifier();
    const { ticket } = await getTicket(frank, v);
    const start = await http("GET", startUrl(ticket, `&userId=${bob.id}&provider=apple&challenge=${challengeOf(newVerifier())}`), { native: false });
    const intent = await decodeLinkIntent(cookieValue(start, LINK_COOKIE));
    check(intent?.userId === frank.id && intent.provider === PROVIDER, "userId, provider et challenge de l'URL ignorés : tout vient du ticket");
  }

  console.log("Ticket rejoué, expiré, inconnu");
  {
    const v = newVerifier();
    const { ticket } = await getTicket(frank, v);
    const first = await http("GET", startUrl(ticket), { native: false });
    check(first.status === 307 || first.status === 302, "première ouverture : OK");
    check((await http("GET", startUrl(ticket), { native: false })).status === 400, "ticket rejoué : refusé");

    const v2 = newVerifier();
    const { ticket: old } = await getTicket(frank, v2);
    await prisma.mobileLinkTicket.update({ where: { ticketHash: sha256(old) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check((await http("GET", startUrl(old), { native: false })).status === 400, "ticket expiré : refusé");
    check((await http("GET", startUrl("n-importe-quoi-n-importe-quoi"), { native: false })).status === 400, "ticket inconnu : refusé");
    check((await http("GET", "/api/mobile-auth/start?mode=link", { native: false })).status === 400, "sans ticket : refusé");
  }

  console.log("PKCE et expiration du code");
  {
    const gina = await makeUser("gina");
    const v = newVerifier();
    const { ticket } = await getTicket(gina, v);
    const flow = await browserFlow(ticket, { status: "?link=taken" });
    check((await exchange(gina, flow.code, newVerifier())).status === 400, "mauvais verifier : refusé");
    check((await exchange(gina, flow.code, v)).status === 400, "…et le code est brûlé (un seul essai)");

    const v2 = newVerifier();
    const { ticket: t2 } = await getTicket(gina, v2);
    const flow2 = await browserFlow(t2, { status: "?link=taken" });
    await prisma.mobileLinkTicket.update({ where: { codeHash: sha256(flow2.code) }, data: { codeExpiresAt: new Date(Date.now() - 1000) } });
    check((await exchange(gina, flow2.code, v2)).status === 400, "code expiré : refusé");
  }

  console.log("Compte OAuth déjà lié à un autre utilisateur");
  {
    const carol = await makeUser("carol");
    const takenSub = `sub-${run}-alice`; // déjà rattaché à Alice
    const v = newVerifier();
    const { ticket } = await getTicket(carol, v);
    const accountsBefore = JSON.stringify(await prisma.account.findMany({ orderBy: { id: "asc" } }));
    const flow = await browserFlow(ticket, {
      status: "?link=taken",
      simulate: async (start) => {
        const intent = await decodeLinkIntent(cookieValue(start, LINK_COOKIE));
        // Ce que fait NextAuth au callback avec les options de liaison.
        const opts = linkAuthOptions(authOptions, intent);
        const target = await opts.callbacks.signIn({ account: { provider: PROVIDER, providerAccountId: takenSub } });
        check(target === "/api/mobile-auth/complete?link=taken", "callback : « taken » renvoie vers complete, sans lier");
      },
    });
    const res = await exchange(carol, flow.code, v);
    const data = await res.json();
    check(res.ok && data.result === "taken", "exchange : taken");
    check(JSON.stringify(await prisma.account.findMany({ orderBy: { id: "asc" } })) === accountsBefore, "aucun compte lié modifié, déplacé ou créé");
    check((await prisma.account.count({ where: { userId: carol.id } })) === 0, "Carol n'a pas reçu le compte d'Alice");
  }

  console.log("Retour sans compte lié, ou sans parcours");
  {
    const v = newVerifier();
    await prisma.account.deleteMany({ where: { userId: bob.id } });
    const { ticket } = await getTicket(bob, v);
    const flow = await browserFlow(ticket); // « linked » annoncé mais rien en base
    const res = await exchange(bob, flow.code, v);
    check((await res.json()).result === "error", "aucun Account en base : le résultat n'est jamais « linked »");
    const orphan = await http("GET", "/api/mobile-auth/complete", { native: false });
    check(orphan.status === 400 && !(orphan.headers.get("location") || "").startsWith("minddump://"), "complete sans cookie de parcours : pas de code");
    const v2 = newVerifier();
    const { ticket: t2 } = await getTicket(bob, v2);
    const never = await http("GET", "/api/mobile-auth/complete", {
      native: false,
      cookies: `minddump.mobile-auth=${encodeURIComponent(JSON.stringify({ mode: "link", ticketId: (await prisma.mobileLinkTicket.findUnique({ where: { ticketHash: sha256(t2) } })).id }))}`,
    });
    check(never.status === 400, "complete avant que le ticket soit consommé par start : refusé");
  }

  console.log("Options NextAuth de liaison (mode app)");
  {
    const dave = await makeUser("dave");
    const intent = { userId: dave.id, provider: PROVIDER, nonce: "a".repeat(32), ticketId: "t" };
    const opts = linkAuthOptions(authOptions, intent);
    const created = await opts.adapter.createUser({ email: "autre@test.local", name: "Autre" });
    check(created.id === dave.id, "createUser renvoie l'utilisateur à lier, pas un nouveau");
    check((await opts.adapter.getUserByEmail(alice.email)) === null, "pas de bascule vers un compte par e-mail");
    check(
      (await opts.callbacks.signIn({ account: { provider: "apple", providerAccountId: "x" } })) === "/api/mobile-auth/complete?link=error",
      "fournisseur différent de celui du ticket : refusé"
    );
    check((await opts.callbacks.signIn({ account: { provider: PROVIDER, providerAccountId: `libre-${run}` } })) === true, "compte libre : liaison autorisée");
    await opts.events.signIn({ user: { id: dave.id }, account: { provider: PROVIDER } });
    check((await prisma.loginEvent.count()) === eventsBefore, "lier n'écrit pas dans l'historique de connexion");
    // Mode web inchangé : retour vers le profil, historique conservé.
    const web = linkAuthOptions(authOptions, { userId: dave.id, provider: PROVIDER, nonce: "b".repeat(32) });
    check(
      (await web.callbacks.signIn({ account: { provider: PROVIDER, providerAccountId: `sub-${run}-alice` } })) === `/profile?link=taken&provider=${PROVIDER}#connexion`,
      "mode web inchangé : « taken » renvoie vers le profil"
    );
  }

  console.log("Déliaison");
  {
    const erin = await makeUser("erin");
    await prisma.account.create({ data: { userId: erin.id, type: "oauth", provider: PROVIDER, providerAccountId: `sub-${run}-erin` } });
    const res = await http("DELETE", `/api/users/me/accounts?provider=${PROVIDER}`, { user: erin });
    check(res.status === 409, "dernier moyen de connexion : déliaison refusée (409)");
    check((await prisma.account.count({ where: { userId: erin.id } })) === 1, "…et le compte reste lié");
    await prisma.user.update({ where: { id: erin.id }, data: { password: "x".repeat(60) } });
    const ok = await http("DELETE", `/api/users/me/accounts?provider=${PROVIDER}`, { user: erin });
    check(ok.status === 200 && (await prisma.account.count({ where: { userId: erin.id } })) === 0, "avec un mot de passe : déliaison autorisée");
    const apiKey = `test-${run}-${randomBytes(6).toString("hex")}`;
    await prisma.apiKey.create({ data: { key: apiKey, userId: erin.id } });
    const viaKey = await fetch(`${BASE_URL}/api/mobile-auth/link-ticket`, { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "user-agent": APP_UA, "content-type": "application/json" }, body: JSON.stringify({ provider: PROVIDER, challenge: challengeOf(newVerifier()) }) });
    check(viaKey.status === 401, "une clé API ne peut pas demander de ticket");
  }

  if (process.env.OAUTH_TEST_ISSUER) {
    const methods = await (await http("GET", "/api/users/me/accounts", { user: alice })).json();
    if (methods.providers?.some((p) => p.id === "test-oidc")) await oidcSuite({ alice, bob, mallory });
    else console.log("Parcours OAuth complet : ignoré (test-oidc inactif : serveur en production)");
  } else {
    console.log("Parcours OAuth complet : ignoré (OAUTH_TEST_ISSUER absent)");
  }

  console.log("Invariants");
  {
    check((await prisma.user.count()) === usersBefore + 4 + (process.env.OAUTH_TEST_ISSUER ? 1 : 0), "aucun utilisateur créé par la liaison (seuls gina, carol, dave, erin, walt du test)");
    check((await prisma.loginEvent.count()) === eventsBefore + (process.env.OAUTH_TEST_ISSUER ? 1 : 0), "aucune connexion enregistrée par la liaison mobile (seule la liaison web, jouée en plus, en écrit une)");
    check((await prisma.mobileDevice.count()) === 0, "aucun appareil (donc aucune session) créé");
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
