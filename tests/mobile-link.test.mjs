/**
 * Liaison d'un compte Google/Apple depuis l'app mobile (src/lib/mobileLink.ts,
 * docs/oauth.md « Connexion depuis l'app mobile »). Modèle de menace couvert :
 *
 *  - un ticket est lié à l'utilisateur connecté au départ : celui d'un autre
 *    utilisateur, rejoué, expiré ou avec un mauvais PKCE ne lie rien ;
 *  - un compte OAuth déjà lié à quelqu'un d'autre n'est jamais déplacé (« taken ») ;
 *  - lier ne crée ni utilisateur, ni session, ni entrée d'historique de connexion ;
 *  - délier le dernier moyen de connexion est refusé ;
 *  - la liaison est DIFFÉRÉE : le callback OAuth ne crée aucun Account (identité en
 *    attente, chiffrée, sur le ticket) ; il n'existe qu'après l'échange du code par
 *    la session du titulaire du ticket (fixation ciblée : ticket de l'attaquant,
 *    OAuth de la victime => aucun Account) ; un parcours abandonné ne lie rien et
 *    l'attente est purgée.
 *
 * Par HTTP contre un serveur MindDump sur une base JETABLE (même principe que
 * tests/ownership.test.mjs), plus les options NextAuth de liaison appelées
 * directement. Le retour du fournisseur est simulé en appelant l'adaptateur de
 * liaison (linkAccount) comme le fait NextAuth : le serveur de production n'active
 * pas le fournisseur de test. Le parcours OAuth
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
const ORIGIN = new URL(BASE_URL).origin;
const CONFIRM_COOKIE = "minddump.link-confirm";
/** GET de la page de confirmation : renvoie la réponse, le HTML, le cookie Strict et le jeton du formulaire. */
async function confirmPage(ticket, extra = "") {
  const res = await http("GET", startUrl(ticket, extra), { native: false });
  const html = res.status === 200 ? await res.text() : "";
  return {
    res,
    html,
    cookie: cookieValue(res, CONFIRM_COOKIE),
    token: html.match(/name="token" value="([^"]+)"/)?.[1] ?? null,
  };
}
/** POST de la page (bouton « Continuer » par défaut). */
const confirmPost = (ticket, { cookie, token, origin = ORIGIN, action = "continue" } = {}) =>
  fetch(`${BASE_URL}/api/mobile-auth/start`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie: `${CONFIRM_COOKIE}=${cookie}` } : {}),
      ...(origin ? { origin } : {}),
    },
    body: new URLSearchParams({ ticket, ...(token ? { token } : {}), action }).toString(),
  });
/** Le navigateur système : page de confirmation, clic sur « Continuer ». */
async function confirmedStart(ticket) {
  const page = await confirmPage(ticket);
  if (!page.cookie || !page.token) return page.res;
  return confirmPost(ticket, page);
}
/** Navigateur système : start (confirmé) puis complete ; renvoie le code (ou null) et les réponses. */
async function browserFlow(ticket, { status = "", simulate } = {}) {
  const start = await confirmedStart(ticket);
  if (start.status !== 303) return { start, code: null };
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
const REFRESH = `refresh-secret-${run}`;
/**
 * Retour du fournisseur simulé : ce que NextAuth fait au callback avec les options de
 * liaison, c.-à-d. adapter.linkAccount (qui met l'identité EN ATTENTE sur le ticket).
 */
async function providerReturns(start, sub, { provider = PROVIDER } = {}) {
  const intent = await decodeLinkIntent(cookieValue(start, LINK_COOKIE));
  const opts = linkAuthOptions(authOptions, intent);
  await opts.adapter.linkAccount({
    userId: intent.userId, type: "oauth", provider, providerAccountId: sub,
    access_token: `access-${run}`, refresh_token: REFRESH, expires_at: 1900000000,
    token_type: "bearer", scope: "openid email", id_token: `idt-${run}`,
  });
  return intent;
}
const accountOf = (sub) => prisma.account.findFirst({ where: { provider: PROVIDER, providerAccountId: sub } });
const ticketRow = (ticket) => prisma.mobileLinkTicket.findUnique({ where: { ticketHash: sha256(ticket) } });

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
  const browse = async (method, url, { body, form, headers = {} } = {}) => {
    const res = await fetch(url.startsWith("http") ? url : BASE_URL + url, {
      method,
      redirect: "manual",
      headers: {
        cookie: jarHeader(),
        ...headers,
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
    const confirm = await browse("GET", startUrl(ticket));
    const token = (await confirm.text()).match(/name="token" value="([^"]+)"/)[1];
    const start = await browse("POST", "/api/mobile-auth/start", {
      form: { ticket, token, action: "continue" },
      headers: { origin: ORIGIN },
    });
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

  // 3 bis. Fixation ciblée : ticket d'un attaquant, OAuth d'une VICTIME dans un autre navigateur.
  const attacker = await makeUser("oidc-attacker");
  const victim = await makeUser("oidc-victim");
  const victimSub = `oidc-sub-${run}-victim`;
  v = newVerifier();
  ticket = (await (await http("POST", "/api/mobile-auth/link-ticket", { user: attacker, body: { provider: "test-oidc", challenge: challengeOf(v) } })).json()).ticket;
  const accountsBeforeAttack = await prisma.account.count();
  flow = await systemBrowser(ticket, victimSub, { email: "victime@exemple.test" });
  check(!!flow.code, "fixation : la victime termine l'OAuth et reçoit un code");
  check((await prisma.account.count()) === accountsBeforeAttack && !(await prisma.account.findFirst({ where: { provider: "test-oidc", providerAccountId: victimSub } })), "fixation : AUCUN Account créé après l'OAuth de la victime");
  const pendingRow = await prisma.mobileLinkTicket.findUnique({ where: { ticketHash: sha256(ticket) } });
  check(pendingRow.pendingProviderAccountId === victimSub && pendingRow.pendingEmail === "victime@exemple.test" && !!pendingRow.pendingTokens, "fixation : l'identité de la victime attend sur le ticket (compte fournisseur, e-mail, jetons chiffrés)");
  res = await exchange(attacker, "faux-code-" + randomBytes(24).toString("base64url"), v);
  check(res.status === 400, "fixation : l'attaquant (sa session + son verifier) sans le code : refusé");
  res = await exchange(victim, flow.code, v);
  check(res.status === 400, "fixation : app de la victime (sa session ≠ ticket.userId) : refusé");
  check((await prisma.account.count()) === accountsBeforeAttack && !(await prisma.account.findFirst({ where: { provider: "test-oidc", providerAccountId: victimSub } })), "fixation : toujours aucun Account, ni pour l'attaquant ni pour la victime");

  // 3 ter. OAuth faite, code jamais échangé (app fermée) : aucune liaison, attente purgée à l'expiration.
  const quit = await makeUser("oidc-quit");
  v = newVerifier();
  ticket = (await (await http("POST", "/api/mobile-auth/link-ticket", { user: quit, body: { provider: "test-oidc", challenge: challengeOf(v) } })).json()).ticket;
  const quitSub = `oidc-sub-${run}-quit`;
  flow = await systemBrowser(ticket, quitSub);
  check(!!flow.code && !(await prisma.account.findFirst({ where: { provider: "test-oidc", providerAccountId: quitSub } })), "abandon : code émis, jamais échangé, aucun Account");
  await prisma.mobileLinkTicket.update({ where: { ticketHash: sha256(ticket) }, data: { codeExpiresAt: new Date(Date.now() - 1000) } });
  await http("POST", "/api/mobile-auth/link-ticket", { user: quit, body: { provider: "test-oidc", challenge: challengeOf(newVerifier()) } });
  check((await prisma.mobileLinkTicket.findUnique({ where: { ticketHash: sha256(ticket) } })).pendingTokens === null, "abandon : attente purgée à l'expiration");
  check((await exchange(quit, flow.code, v)).status === 400 && !(await prisma.account.findFirst({ where: { provider: "test-oidc", providerAccountId: quitSub } })), "abandon : échange tardif refusé, rien lié");

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
      // Retour du fournisseur : NextAuth (options de liaison) met l'identité EN ATTENTE sur le ticket.
      simulate: async (start) => {
        const intent = await providerReturns(start, sub);
        check(intent?.userId === alice.id && intent.provider === PROVIDER && !!intent.nonce && !!intent.ticketId, "start pose l'intention de liaison : utilisateur du TICKET, nonce, ticket");
        check(!(await accountOf(sub)), "callback : AUCUN Account créé (identité en attente)");
        const pending = await ticketRow(ticket);
        check(pending.pendingProviderAccountId === sub && !!pending.pendingTokens, "callback : identité mise en attente sur le ticket");
        check(!pending.pendingTokens.includes(REFRESH) && !pending.pendingTokens.includes(`access-${run}`) && !pending.pendingTokens.includes(`idt-${run}`), "jetons en attente chiffrés au repos (ni refresh, ni access, ni id_token en clair)");
      },
    });
    check(!(await accountOf(sub)), "complete : toujours aucun Account (le code n'a pas encore été échangé)");
    check(!!flow.code, "complete renvoie minddump://auth?code=…");
    check(!setCookies(flow.complete).some((c) => c.includes("session-token=") && !c.endsWith("=")), "complete ne pose aucun cookie de session");
    check(!flow.location.includes("verifier"), "le retour n'expose pas de verifier");
    const res = await exchange(alice, flow.code, v);
    const data = await res.json();
    check(res.ok && data.result === "linked" && data.provider === PROVIDER, "exchange : linked");
    const made = await accountOf(sub);
    check(made?.userId === alice.id && made.type === "oauth" && made.refresh_token === REFRESH && made.access_token === `access-${run}` && made.id_token === `idt-${run}` && made.expires_at === 1900000000 && made.scope === "openid email", "exchange : l'Account est créé pour Alice avec ses jetons (refresh_token compris)");
    const after = await ticketRow(ticket);
    check(after.pendingProviderAccountId === null && after.pendingTokens === null && after.pendingEmail === null, "exchange : identité en attente purgée");
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
        const intent = await providerReturns(start, `sub-${run}-bob`);
        check(intent?.userId === bob.id, "l'intention suit le ticket de Bob");
      },
    });
    // La WebView d'Alice présente le code du ticket de Bob avec le bon verifier.
    const res = await exchange(alice, flow.code, v);
    check(res.status === 400, "session d'Alice + ticket de Bob : refusé");
    check((await prisma.account.count({ where: { userId: alice.id } })) === 1, "Alice n'a toujours qu'un compte lié");
    check((await exchange(bob, flow.code, v)).status === 400, "le code est brûlé même après un essai raté");
    check(!(await accountOf(`sub-${run}-bob`)), "…et aucun Account n'est créé pour l'identité en attente (ni pour Bob, le code étant brûlé)");
    const burnt = await ticketRow(ticket);
    check(burnt.pendingTokens === null && burnt.pendingProviderAccountId === null, "…l'attente est purgée dès la tentative refusée");
    check((await http("POST", "/api/mobile-auth/link-exchange", { body: { code: flow.code, verifier: v } })).status === 401, "exchange sans session : 401");
  }

  console.log("Paramètres d'URL ignorés");
  {
    const v = newVerifier();
    const { ticket } = await getTicket(frank, v);
    const page = await confirmPage(ticket, `&userId=${bob.id}&provider=apple&challenge=${challengeOf(newVerifier())}`);
    const start = await confirmPost(ticket, page);
    const intent = await decodeLinkIntent(cookieValue(start, LINK_COOKIE));
    check(intent?.userId === frank.id && intent.provider === PROVIDER, "userId, provider et challenge de l'URL ignorés : tout vient du ticket");
  }

  console.log("Ticket rejoué, expiré, inconnu");
  {
    const v = newVerifier();
    const { ticket } = await getTicket(frank, v);
    const page = await confirmPage(ticket);
    const first = await confirmPost(ticket, page);
    check(first.status === 303, "première confirmation : OK");
    check((await confirmPost(ticket, page)).status === 400, "ticket rejoué (même cookie et jeton) : refusé");
    check((await http("GET", startUrl(ticket), { native: false })).status === 400, "…et la page de confirmation ne s'ouvre plus");

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
    const orphanLink = await http("GET", "/api/mobile-auth/complete?link=error", { native: false });
    check(orphanLink.status === 307 && (orphanLink.headers.get("location") || "").includes("/login?error=LinkExpired"), "complete?link=error sans cookie de défi : redirection vers /login, jamais un JSON brut");
    const v2 = newVerifier();
    const { ticket: t2 } = await getTicket(bob, v2);
    const never = await http("GET", "/api/mobile-auth/complete", {
      native: false,
      cookies: `minddump.mobile-auth=${encodeURIComponent(JSON.stringify({ mode: "link", ticketId: (await prisma.mobileLinkTicket.findUnique({ where: { ticketHash: sha256(t2) } })).id }))}`,
    });
    check(never.status === 307 && (never.headers.get("location") || "").includes("/login?error=LinkExpired"), "complete avant que le ticket soit consommé par start : refusé (retour /login)");
  }

  console.log("Confirmation avant liaison (fixation de ticket)");
  {
    const vera = await makeUser("vera");
    await prisma.user.update({ where: { id: vera.id }, data: { email: "victime@exemple.test" } });
    const v = newVerifier();
    const { ticket } = await getTicket(vera, v);
    const page = await confirmPage(ticket);
    check(page.res.status === 200 && (page.res.headers.get("content-type") || "").includes("text/html"), "GET : page de confirmation (HTML), pas une redirection");
    check(page.html.includes("vera") && page.html.includes("victime@exemple.test"), "la page nomme le titulaire (nom et e-mail COMPLET)");
    check(!page.html.includes("v•••@"), "…sans masque");
    check(page.html.includes("Si quelqu'un t'a envoyé ce lien, refuse."), "avertissement « Si quelqu'un t'a envoyé ce lien, refuse. »");
    const csp = page.res.headers.get("content-security-policy") || "";
    check(csp === "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" && !/form-action/i.test(csp), "en-tête Content-Security-Policy (sans form-action : le 303 vers minddump:// doit passer)");
    check(page.res.headers.get("referrer-policy") === "same-origin", "en-tête Referrer-Policy: same-origin (aucun Referer vers un autre site, et Origin conservée sur le POST)");
    check(page.html.includes("Continuer") && page.html.includes("Ce n'est pas mon compte"), "boutons « Continuer » et « Ce n'est pas mon compte »");
    const raw = page.res.headers.getSetCookie();
    check(raw.length === 1 && raw[0].startsWith(`${CONFIRM_COOKIE}=`) && /samesite=strict/i.test(raw[0]) && /httponly/i.test(raw[0]) && /max-age=\d+/i.test(raw[0]), "GET : seul cookie posé = jeton SameSite=Strict, httpOnly, courte durée");
    check(!raw.some((c) => c.includes(LINK_COOKIE) || c.includes("mobile-auth=")), "GET : aucune intention de liaison, aucun cookie de défi");
    check((await prisma.mobileLinkTicket.findUnique({ where: { ticketHash: sha256(ticket) } })).startedAt === null, "GET : le ticket n'est pas consommé");
    check((await confirmPage(ticket)).res.status === 200, "GET répété : toujours la page");

    const noCookie = await confirmPost(ticket, { token: page.token });
    check(noCookie.status === 403 && !cookieValue(noCookie, LINK_COOKIE), "POST sans le cookie Strict (formulaire d'un autre site) : refusé, aucune intention");
    check((await confirmPost(ticket, { cookie: page.cookie, token: "x".repeat(32) })).status === 403, "POST avec un mauvais jeton : refusé");
    check((await confirmPost(ticket, { cookie: page.cookie })).status === 403, "POST sans jeton : refusé");
    const other = await confirmPage((await getTicket(vera, newVerifier())).ticket);
    check((await confirmPost(ticket, { cookie: other.cookie, token: other.token })).status === 403, "cookie et jeton d'un AUTRE ticket : refusé");
    const wrongOrigin = await confirmPost(ticket, { ...page, origin: "https://evil.example" });
    check(wrongOrigin.status === 403 && !cookieValue(wrongOrigin, LINK_COOKIE), "POST avec une mauvaise Origin : refusé");
    check((await confirmPost(ticket, { ...page, origin: "null" })).status === 403, "POST avec Origin « null » : refusé");
    check((await confirmPost(ticket, { ...page, origin: "" })).status === 403, "POST sans Origin : refusé");
    check((await prisma.mobileLinkTicket.findUnique({ where: { ticketHash: sha256(ticket) } })).startedAt === null, "tous ces refus laissent le ticket intact");

    const ok = await confirmPost(ticket, page);
    const intent = await decodeLinkIntent(cookieValue(ok, LINK_COOKIE));
    check(ok.status === 303 && intent?.userId === vera.id && !!intent.ticketId, "POST complet : intention posée pour le titulaire du ticket, redirection vers /auth/mobile");

    // « Ce n'est pas mon compte »
    const { ticket: t2 } = await getTicket(vera, newVerifier());
    const page2 = await confirmPage(t2);
    check((await confirmPost(t2, { token: page2.token, action: "cancel" })).status === 403, "annuler sans le cookie Strict : refusé");
    const cancel = await confirmPost(t2, { ...page2, action: "cancel" });
    check(cancel.status === 303 && (cancel.headers.get("location") || "").startsWith("minddump://auth?cancelled=1") && !cookieValue(cancel, LINK_COOKIE), "« Ce n'est pas mon compte » : retour à l'app (cancelled), aucune intention");
    check((await http("GET", startUrl(t2), { native: false })).status === 400, "…et le ticket ne sert plus");
  }

  console.log("Intention de liaison abandonnée");
  {
    const abandon = await makeUser("abandon");
    const { ticket } = await getTicket(abandon, newVerifier());
    const start = await confirmedStart(ticket);
    const intentCookie = cookieValue(start, LINK_COOKIE);
    check(!!intentCookie, "liaison démarrée (intention posée), puis abandonnée");
    // Connexion normale ensuite, dans le même navigateur : start (mode connexion) efface l'intention.
    const login = await http("GET", `/api/mobile-auth/start?provider=google&challenge=${challengeOf(newVerifier())}`, { native: false, cookies: `${LINK_COOKIE}=${intentCookie}` });
    const cleared = login.headers.getSetCookie().find((c) => c.startsWith(`${LINK_COOKIE}=;`));
    check(login.status === 307 && !!cleared && /max-age=0/i.test(cleared) && /path=\/api\/auth/i.test(cleared), "start (mode connexion) efface l'intention abandonnée (mêmes Path et attributs)");
    check(!!cookieValue(login, "minddump.mobile-auth"), "…et réécrit le cookie de défi");
    // Si l'intention survit quand même, le callback ne détourne pas la connexion.
    const cb = await http("GET", "/api/auth/callback/google", { native: false, cookies: `${LINK_COOKIE}=${intentCookie}` });
    const loc = cb.headers.get("location") || "";
    check(!loc.includes("/api/mobile-auth/complete?link=error") && !loc.startsWith("minddump://"), "callback avec une intention d'une autre tentative : connexion normale, pas de complete?link=error");
    check(cb.headers.getSetCookie().some((c) => c.startsWith(`${LINK_COOKIE}=;`)), "…et l'intention est effacée");
  }

  console.log("Refus chez le fournisseur");
  {
    // NextAuth renvoie un refus (access_denied) vers /api/auth/signin?error=… ou /api/auth/error?error=…
    // La tentative en cours : le nonce du cookie de parcours est celui de l'URL de retour mémorisée par NextAuth.
    const nonce = "n".repeat(32);
    const linkCookie = `minddump.mobile-auth=${encodeURIComponent(JSON.stringify({ mode: "link", ticketId: "t", nonce }))}`;
    const callbackCookie = `next-auth.callback-url=${encodeURIComponent(`${BASE_URL}/api/mobile-auth/complete?li=${nonce}`)}`;
    for (const path of ["/api/auth/signin?error=Callback&callbackUrl=x", "/api/auth/error?error=AccessDenied"]) {
      const denied = await http("GET", path, { native: false, cookies: `${linkCookie}; ${callbackCookie}` });
      check(denied.status === 303 && (denied.headers.get("location") || "").endsWith("/api/mobile-auth/complete?link=error"), `refus du fournisseur (${path.split("?")[0]}) en liaison : retour vers complete?link=error`);
    }
    // Liaison abandonnée puis erreur de connexion WEB dans le même navigateur : /login, et le cookie de parcours est effacé.
    const webCallback = `next-auth.callback-url=${encodeURIComponent(`${BASE_URL}/`)}`;
    for (const [label, cookies] of [["URL de retour d'une autre tentative", `${linkCookie}; ${webCallback}`], ["sans URL de retour", linkCookie]]) {
      const stale = await http("GET", "/api/auth/error?error=OAuthCallback", { native: false, cookies });
      const loc = stale.headers.get("location") || "";
      check(!loc.includes("/api/mobile-auth/complete") && !loc.startsWith("minddump://"), `cookie de parcours périmé (${label}) : l'erreur web ne revient pas vers l'app`);
      check(stale.headers.getSetCookie().some((c) => c.startsWith("minddump.mobile-auth=;") && /max-age=0/i.test(c)), `…et le cookie de parcours est effacé (${label})`);
    }
    const lateComplete = await http("GET", "/api/mobile-auth/complete?link=error", { native: false, cookies: `minddump.mobile-auth=${encodeURIComponent(JSON.stringify({ mode: "link", ticketId: "inconnu" }))}` });
    check(lateComplete.headers.getSetCookie().some((c) => c.startsWith("minddump.mobile-auth=;")), "complete (parcours invalide) : le cookie de parcours est effacé aussi");
    const plain = await http("GET", "/api/auth/signin?error=Callback", { native: false });
    check(!(plain.headers.get("location") || "").includes("/api/mobile-auth/complete"), "…mais pas sans parcours de liaison en cours (connexion normale intacte)");
    const normal = await http("GET", "/api/auth/signin?error=Callback", { native: false, cookies: `minddump.mobile-auth=${encodeURIComponent(JSON.stringify({ challenge: challengeOf(newVerifier()), provider: "google" }))}` });
    check(!(normal.headers.get("location") || "").includes("/api/mobile-auth/complete"), "…ni pendant une connexion mobile ordinaire");
    const hana = await makeUser("hana");
    const v = newVerifier();
    const { ticket } = await getTicket(hana, v);
    const flow = await browserFlow(ticket, {
      status: "?link=error&error=OAuthCallback",
      simulate: async (start) => {
        // Une identité est en attente : malgré cela, un retour en erreur n'est jamais un succès.
        await providerReturns(start, `sub-${run}-hana`);
      },
    });
    check((await ticketRow(ticket)).pendingTokens === null, "retour en erreur : l'attente est purgée dès complete");
    check((await (await exchange(hana, flow.code, v)).json()).result === "error", "retour en erreur : résultat « error », jamais « linked »");
    check(!(await accountOf(`sub-${run}-hana`)), "retour en erreur : aucun Account créé");
    const v2 = newVerifier();
    await prisma.account.deleteMany({ where: { userId: hana.id } });
    const { ticket: t2 } = await getTicket(hana, v2);
    const flow2 = await browserFlow(t2, {
      status: "?error=AccessDenied",
      simulate: async (start) => {
        await providerReturns(start, `sub-${run}-hana2`);
      },
    });
    check((await (await exchange(hana, flow2.code, v2)).json()).result === "error", "?error=… seul (sans link) : « error » aussi");
    check(!(await accountOf(`sub-${run}-hana2`)), "…et aucun Account créé");
    await prisma.account.deleteMany({ where: { userId: hana.id } });
  }

  console.log("Liaison différée : fixation ciblée par usurpation");
  {
    const attacker = await makeUser("attacker");
    const victim = await makeUser("victim");
    const victimSub = `sub-${run}-victim-google`;
    const va = newVerifier();
    const { ticket } = await getTicket(attacker, va);
    // La victime ouvre le lien de l'attaquant dans SON navigateur, confirme, fait l'OAuth avec SON Google.
    const flow = await browserFlow(ticket, { simulate: async (start) => { await providerReturns(start, victimSub); } });
    check(!!flow.code, "la victime reçoit un code (dans son navigateur, vers son app)");
    check(!(await accountOf(victimSub)), "OAuth de la victime terminé : AUCUN Account (ni pour l'attaquant, ni pour elle)");
    // L'attaquant ne connaît pas le code : il essaie avec sa session et son verifier.
    for (const guess of [randomBytes(32).toString("base64url"), ticket, "x".repeat(43)]) {
      check((await exchange(attacker, guess, va)).status === 400, "l'attaquant (sa session + son verifier) sans le bon code : échange refusé");
    }
    check(!(await accountOf(victimSub)), "…toujours aucun Account après les essais de l'attaquant");
    // Le code arrive dans l'app de la victime : sa session n'est pas celle du ticket.
    check((await exchange(victim, flow.code, va)).status === 400, "app de la victime (sa session ≠ ticket.userId) : échange refusé");
    check((await exchange(victim, flow.code, newVerifier())).status === 400, "…avec un autre verifier aussi");
    check(!(await accountOf(victimSub)) && (await prisma.account.count({ where: { userId: { in: [attacker.id, victim.id] } } })) === 0, "aucun Account créé, ni pour l'attaquant ni pour la victime");
    const row = await ticketRow(ticket);
    check(row.pendingTokens === null && row.pendingProviderAccountId === null, "l'identité de la victime est purgée du ticket");
    check((await exchange(attacker, flow.code, va)).status === 400, "même un code intercepté ne sert plus après la tentative refusée (brûlé)");
    check(!(await accountOf(victimSub)), "…toujours aucun Account");
  }

  console.log("Parcours abandonné après l'OAuth");
  {
    const quinn = await makeUser("quinn");
    const sub = `sub-${run}-quinn`;
    const { ticket } = await getTicket(quinn, newVerifier());
    const start = await confirmedStart(ticket);
    await providerReturns(start, sub);
    check(!(await accountOf(sub)) && !!(await ticketRow(ticket)).pendingTokens, "après l'OAuth : identité en attente, aucun Account");
    // Jamais de complete ni d'échange. Le parcours expire (15 min) : l'attente est purgée à la prochaine émission de ticket.
    await prisma.mobileLinkTicket.update({ where: { ticketHash: sha256(ticket) }, data: { startedAt: new Date(Date.now() - 16 * 60 * 1000) } });
    check((await getTicket(quinn, newVerifier())).res.ok, "une nouvelle émission de ticket déclenche la purge");
    const gone = await ticketRow(ticket);
    check(gone.pendingTokens === null && gone.pendingProviderAccountId === null && gone.pendingEmail === null, "parcours expiré : identité en attente purgée");
    check(!(await accountOf(sub)), "…et aucune liaison n'existe");
    // Retour tardif (complete après expiration) : refusé, rien lié.
    const late = await http("GET", "/api/mobile-auth/complete", { native: false, cookies: `minddump.mobile-auth=${encodeURIComponent(JSON.stringify({ mode: "link", ticketId: gone.id }))}` });
    check(late.status === 307 && (late.headers.get("location") || "").includes("/login?error=LinkExpired") && !(await accountOf(sub)), "complete après expiration du parcours : refusé, rien lié");

    // Code émis mais jamais échangé : purgé à l'expiration du code.
    const rex = await makeUser("rex");
    const rsub = `sub-${run}-rex`;
    const rv = newVerifier();
    const { ticket: rt } = await getTicket(rex, rv);
    const rflow = await browserFlow(rt, { simulate: async (st) => { await providerReturns(st, rsub); } });
    check(!!rflow.code && !(await accountOf(rsub)), "code émis mais pas échangé : aucun Account");
    await prisma.mobileLinkTicket.update({ where: { ticketHash: sha256(rt) }, data: { codeExpiresAt: new Date(Date.now() - 1000) } });
    await getTicket(rex, newVerifier());
    check((await ticketRow(rt)).pendingTokens === null, "code expiré non échangé : identité en attente purgée");
    check((await exchange(rex, rflow.code, rv)).status === 400 && !(await accountOf(rsub)), "…et l'échange tardif est refusé, rien lié");
  }

  console.log("Compte pris entre le callback et l'échange");
  {
    const sam = await makeUser("sam");
    const thief = await makeUser("thief");
    const sub = `sub-${run}-race`;
    const v = newVerifier();
    const { ticket } = await getTicket(sam, v);
    const flow = await browserFlow(ticket, { simulate: async (st) => { await providerReturns(st, sub); } });
    // Entre-temps, ce compte fournisseur est lié à quelqu'un d'autre.
    await prisma.account.create({ data: { userId: thief.id, type: "oauth", provider: PROVIDER, providerAccountId: sub } });
    const res = await exchange(sam, flow.code, v);
    check(res.ok && (await res.json()).result === "taken", "exchange : taken (la contrainte unique est revérifiée à l'échange)");
    const kept = await accountOf(sub);
    check(kept?.userId === thief.id && (await prisma.account.count({ where: { userId: sam.id } })) === 0, "le compte déjà lié n'est pas déplacé, Sam n'a rien reçu");
    check((await ticketRow(ticket)).pendingTokens === null, "attente purgée");
    // Callback : déjà lié à un autre au moment du callback => taken tout de suite, rien en attente.
    const sam2 = await makeUser("sam2");
    const v2 = newVerifier();
    const { ticket: t2 } = await getTicket(sam2, v2);
    const flow2 = await browserFlow(t2, {
      status: "?link=taken",
      simulate: async (st) => {
        const intent = await decodeLinkIntent(cookieValue(st, LINK_COOKIE));
        const target = await linkAuthOptions(authOptions, intent).callbacks.signIn({ account: { provider: PROVIDER, providerAccountId: sub } });
        check(target === "/api/mobile-auth/complete?link=taken", "callback : compte déjà lié à un autre => taken immédiat");
      },
    });
    check((await ticketRow(t2)).pendingTokens === null, "taken au callback : rien mis en attente");
    check((await (await exchange(sam2, flow2.code, v2)).json()).result === "taken", "exchange : taken");
  }

  console.log("Limite de tickets");
  {
    const rita = await makeUser("rita");
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await http("POST", "/api/mobile-auth/link-ticket", { user: rita, body: { provider: PROVIDER, challenge: challengeOf(newVerifier()) } })).status);
    check(codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429, "5 tickets actifs au plus par utilisateur : le 6e est refusé (429)");
    const body = await (await http("POST", "/api/mobile-auth/link-ticket", { user: rita, body: { provider: PROVIDER, challenge: challengeOf(newVerifier()) } })).json();
    check(body.error === "Trop de tentatives, réessaie dans quelques minutes.", "message français");
    await prisma.mobileLinkTicket.updateMany({ where: { userId: rita.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check((await http("POST", "/api/mobile-auth/link-ticket", { user: rita, body: { provider: PROVIDER, challenge: challengeOf(newVerifier()) } })).status === 200, "tickets expirés : ne comptent plus");
    const other = await makeUser("rita2");
    check((await http("POST", "/api/mobile-auth/link-ticket", { user: other, body: { provider: PROVIDER, challenge: challengeOf(newVerifier()) } })).status === 200, "la limite est par utilisateur");
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
    let refused = false;
    await opts.adapter.linkAccount({ userId: dave.id, type: "oauth", provider: PROVIDER, providerAccountId: `libre-${run}` }).catch(() => { refused = true; });
    check(refused && !(await accountOf(`libre-${run}`)), "linkAccount (mode app) sans parcours en cours : refusé, aucun Account créé");
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
    // Deux déliaisons simultanées sans mot de passe : il doit rester un moyen de connexion.
    let racesOk = true;
    for (let i = 0; i < 6; i++) {
      const racer = await makeUser(`racer${i}`);
      await prisma.account.createMany({
        data: [
          { userId: racer.id, type: "oauth", provider: "google", providerAccountId: `g-${run}-${i}` },
          { userId: racer.id, type: "oauth", provider: "apple", providerAccountId: `a-${run}-${i}` },
        ],
      });
      const [a, b] = await Promise.all([
        http("DELETE", "/api/users/me/accounts?provider=google", { user: racer }),
        http("DELETE", "/api/users/me/accounts?provider=apple", { user: racer }),
      ]);
      const left = await prisma.account.count({ where: { userId: racer.id } });
      if (left !== 1 || [a.status, b.status].sort().join() !== "200,409") racesOk = false;
    }
    check(racesOk, "deux DELETE concurrents (Google et Apple, sans mot de passe) : un 200, un 409, un moyen de connexion reste (6 essais)");
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
    check((await prisma.user.count()) === usersBefore + 4 + 6 + 5 + 7 + (process.env.OAUTH_TEST_ISSUER ? 4 : 0), "aucun utilisateur créé par la liaison (seuls ceux du test : gina, carol, dave, erin, vera, abandon, hana, rita, rita2, 6 racers, attacker, victim, quinn, rex, sam, thief, sam2, puis walt et oidc-attacker/victim/quit)");
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
