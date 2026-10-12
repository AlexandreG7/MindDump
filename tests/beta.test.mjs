/**
 * Test de la bêta privée : demandes d'accès, traitement dans /admin, liens
 * d'inscription à usage unique (src/lib/betaAccess.ts, src/lib/signupInvite.ts).
 *
 * Mêmes serveurs et même base JETABLE que tests/signup.test.mjs (scripts/test-signup.sh) :
 *   BASE_URL  ALLOWED_SIGNUP_EMAILS = « ALICE@…, bob@…, kelly@… »
 * Le fournisseur OAuth `test-oidc` n'existe pas en production : les callbacks NextAuth
 * (signIn, adaptateur) sont appelés directement, avec la même fabrique d'options que la
 * route [...nextauth] (authOptionsWithInvite) quand le cookie d'invitation est présent.
 *
 * Lancer avec tsx : npm run test:signup (enchaîne signup puis beta).
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";

if (process.env.OWNERSHIP_TEST_DB !== "disposable") {
  console.error("Refus : OWNERSHIP_TEST_DB=disposable requis (ce test écrit dans la base).");
  process.exit(2);
}
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const run = process.env.SIGNUP_TEST_RUN_ID || randomBytes(4).toString("hex");
const LIST = ` ALICE-${run}@Test.Local , bob-${run}@test.local ,, kelly-${run}@test.local `;
process.env.ALLOWED_SIGNUP_EMAILS = LIST;
process.env.NODE_ENV = "development";
process.env.OAUTH_TEST_ISSUER = "http://localhost:4010";
process.env.NEXTAUTH_URL = BASE_URL;

const unwrap = (mod) => ({ ...mod.default, ...mod });
const { authOptions, authOptionsWithInvite, SIGNUP_CLOSED_URL } = unwrap(await import("../src/lib/auth.ts"));
const { hashPassword } = unwrap(await import("../src/lib/password.ts"));
const { INVITE_EMAIL_MISMATCH_URL, INVITE_INVALID_MESSAGE, INVITE_EMAIL_MISMATCH_MESSAGE, INVITE_COOKIE, issueInvite, createUserWithGrant } = unwrap(
  await import("../src/lib/signupInvite.ts")
);
const { purgeOldBetaData, purgeOldBetaDataThrottled, listBetaRequests, refuseBetaRequest, submitAccessRequest, deleteBetaRequest, deleteDirectInvites } = unwrap(
  await import("../src/lib/betaAccess.ts")
);
const { findValidInvite: findValid } = unwrap(await import("../src/lib/signupInvite.ts"));
const { rateLimit } = unwrap(await import("../src/lib/rateLimit.ts"));
const { deleteUserAccount } = unwrap(await import("../src/lib/account.ts"));
const { oauthErrorMessage } = unwrap(await import("../src/components/OAuthButtons.tsx"));

const prisma = new PrismaClient();
let failures = 0;
let checks = 0;
const check = (cond, label) => {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
};

const sha = (v) => createHash("sha256").update(v).digest("hex");
let ipCounter = 0;
const freshIp = () => `10.2.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const tokenOf = (link) => new URL(link).searchParams.get("invite");
const email = (label) => `${label}-${run}@test.local`;

async function post(path, body, { ip = freshIp(), cookie } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { res, status: res.status, body: await res.json().catch(() => null) };
}
const requestAccess = (fields, opts) =>
  post("/api/beta-requests", { name: "Zoé", message: "", consent: true, ...fields }, opts);
const register = (fields, opts) =>
  post("/api/auth/register", { name: "Test", password: "motdepasse-solide", consent: true, ...fields }, opts);

/** Connexion e-mail / mot de passe : renvoie l'en-tête Cookie de la session. */
async function login(email, password) {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }).toString(),
  });
  const session = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.includes("next-auth.session-token="));
  return session ? [csrfCookie, session].join("; ") : null;
}
const EVIL = "https://evil.example";
const api = (method, path, cookie, body, extraHeaders = {}) =>
  fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...extraHeaders },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const oauthAccount = (id) => ({ provider: "test-oidc", type: "oauth", providerAccountId: id });
const oauthSignIn = (options, address, { verified = true } = {}) => {
  const id = `sub-${randomBytes(4).toString("hex")}`;
  return options.callbacks.signIn({
    user: { id, email: address, name: "Invité" },
    account: oauthAccount(id),
    profile: { email: address, ...(verified === "absent" ? {} : { email_verified: verified }) },
  });
};

async function main() {
  const adminPassword = "mot-de-passe-admin";
  const admin = await prisma.user.create({
    data: { name: "Admin", email: email("admin"), password: hashPassword(adminPassword), role: "admin", consentedAt: new Date() },
  });
  const plainPassword = "mot-de-passe-simple";
  await prisma.user.create({
    data: { name: "Simple", email: email("simple"), password: hashPassword(plainPassword), role: "user", consentedAt: new Date() },
  });
  const existingUser = email("deja-inscrit");
  await prisma.user.create({ data: { name: "Déjà", email: existingUser, password: hashPassword("mdp-deja-inscrit"), consentedAt: new Date() } });
  const adminCookie = await login(email("admin"), adminPassword);
  const userCookie = await login(email("simple"), plainPassword);
  check(!!adminCookie && !!userCookie, "sessions de test (administrateur, utilisateur simple)");

  console.log("RGPD : la route publique ne purge plus, l'admin purge au plus une fois par heure");
  {
    const old = new Date();
    old.setMonth(old.getMonth() - 7);
    await prisma.betaAccessRequest.create({ data: { email: email("perimee-1"), name: "Périmée", consentVersion: "x", createdAt: old, updatedAt: old } });
    const pub = await requestAccess({ email: email("depot-public") });
    check(pub.status === 200 && !!(await prisma.betaAccessRequest.findUnique({ where: { email: email("perimee-1") } })), "un dépôt public ne supprime rien (plus de purge sur la route publique)");
    const first = await api("GET", "/api/admin/beta-requests", adminCookie);
    check(first.status === 200 && !(await prisma.betaAccessRequest.findUnique({ where: { email: email("perimee-1") } })), "la première ouverture de la liste admin purge");
    await prisma.betaAccessRequest.create({ data: { email: email("perimee-2"), name: "Périmée 2", consentVersion: "x", createdAt: old, updatedAt: old } });
    await api("GET", "/api/admin/beta-requests", adminCookie);
    check(!!(await prisma.betaAccessRequest.findUnique({ where: { email: email("perimee-2") } })), "…mais pas une seconde fois dans l'heure");
    await prisma.betaAccessRequest.delete({ where: { email: email("perimee-2") } });
    const T = 4_000_000_000_000;
    check((await purgeOldBetaDataThrottled(T)) === true && (await purgeOldBetaDataThrottled(T + 59 * 60_000)) === false && (await purgeOldBetaDataThrottled(T + 61 * 60_000)) === true, "purge limitée à une par heure (horodatage au niveau du module)");
  }

  console.log("Demande d'accès : réponse uniforme, fusion, validation");
  let firstRequestId;
  {
    const fresh = await requestAccess({ email: email("zoe"), message: "Première version" });
    check(fresh.status === 200 && fresh.body?.ok === true, "nouvelle demande : 200 { ok: true }");
    const stored = await prisma.betaAccessRequest.findUnique({ where: { email: email("zoe") } });
    firstRequestId = stored?.id;
    check(stored?.status === "pending" && stored.name === "Zoé" && stored.consentVersion, "demande enregistrée (en attente, prénom, version du consentement)");

    const dup = await requestAccess({ email: `  ZOE-${run}@Test.Local `, name: "Zoé B.", message: "Deuxième version" });
    check(dup.status === 200 && JSON.stringify(dup.body) === JSON.stringify(fresh.body), "doublon (autre casse, espaces) : même réponse");
    check((await prisma.betaAccessRequest.count({ where: { email: { contains: `zoe-${run}`, mode: "insensitive" } } })) === 1, "doublons fusionnés : une demande par adresse normalisée");
    const merged = await prisma.betaAccessRequest.findUnique({ where: { email: email("zoe") } });
    check(merged?.message === "Deuxième version" && merged.name === "Zoé B.", "la demande en attente est mise à jour par la plus récente");

    const account = await requestAccess({ email: existingUser });
    check(account.status === 200 && JSON.stringify(account.body) === JSON.stringify(fresh.body), "adresse qui a déjà un compte : même réponse");
    check((await prisma.betaAccessRequest.count({ where: { email: existingUser } })) === 0, "…et aucune demande enregistrée pour elle");
    const accountUpper = await requestAccess({ email: existingUser.toUpperCase() });
    check(accountUpper.status === 200 && (await prisma.betaAccessRequest.count({ where: { email: { equals: existingUser, mode: "insensitive" } } })) === 0, "compte existant, autre casse : idem");

    const invited = await issueInvite({ email: email("deja-invite"), createdById: admin.id });
    const withInvite = await requestAccess({ email: email("deja-invite") });
    check(withInvite.status === 200 && JSON.stringify(withInvite.body) === JSON.stringify(fresh.body), "adresse déjà invitée : même réponse");
    check((await prisma.betaAccessRequest.count({ where: { email: email("deja-invite") } })) === 0 && !!invited.token, "…et pas de demande en double");

    const bad = await requestAccess({ email: "pas-un-mail" });
    check(bad.status === 400, "adresse invalide : 400");
    check((await requestAccess({ email: "Kelly@test.local" })).status === 400, "adresse non ASCII (Kelvin) : 400");
    check((await requestAccess({ email: email("sans-nom"), name: "  " })).status === 400, "prénom vide : 400");
    check((await requestAccess({ email: email("sans-consent"), consent: false })).status === 400, "consentement absent : 400");
    check((await requestAccess({ email: email("long"), message: "x".repeat(501) })).status === 400, "message de 501 caractères : 400");
    check((await requestAccess({ email: email("limite"), message: "x".repeat(500) })).status === 200, "message de 500 caractères : accepté");
    check((await prisma.betaAccessRequest.count({ where: { email: { in: [email("sans-nom"), email("sans-consent"), email("long")] } } })) === 0, "aucune demande invalide enregistrée");
    const garbage = await fetch(`${BASE_URL}/api/beta-requests`, { method: "POST", body: "pas du json" });
    check(garbage.status === 400, "corps illisible : 400, pas de 500");
  }

  console.log("Limite de débit par IP (A2)");
  {
    const ip = "198.51.100.7";
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await requestAccess({ email: email(`rate${i}`) }, { ip })).status);
    check(statuses.slice(0, 5).every((s) => s === 200) && statuses[5] === 429 && statuses[6] === 429, `demande d'accès : 5 par heure et par IP, puis 429 (${statuses.join(",")})`);
    check((await requestAccess({ email: email("rate-autre-ip") }, { ip: "198.51.100.8" })).status === 200, "une autre IP n'est pas touchée");
    check((await prisma.betaAccessRequest.count({ where: { email: { in: [email("rate5"), email("rate6")] } } })) === 0, "les demandes refusées par la limite ne sont pas enregistrées");
    // X-Forwarded-For : seule la dernière entrée (ajoutée par le proxy) compte, pas une valeur inventée par le client.
    const spoof = [];
    for (let i = 0; i < 7; i++) spoof.push((await requestAccess({ email: email(`spoof${i}`) }, { ip: `1.2.3.${i}, 198.51.100.9` })).status);
    check(spoof[5] === 429, "X-Forwarded-For inventé en tête : ignoré, la limite s'applique");

    const regIp = "198.51.100.20";
    const regStatuses = [];
    for (let i = 0; i < 12; i++) regStatuses.push((await register({ email: email(`reg-rate${i}`) }, { ip: regIp })).status);
    check(regStatuses.slice(0, 10).every((s) => s === 403) && regStatuses[10] === 429, `inscription : 10 essais par 15 min et par IP, puis 429 (${regStatuses.join(",")})`);
    check((await register({ email: email("reg-autre-ip") })).status === 403, "une autre IP n'est pas touchée");
    // Unité : la fenêtre se vide.
    check(rateLimit("t", 2, 1000, 0) && rateLimit("t", 2, 1000, 1) && !rateLimit("t", 2, 1000, 2) && rateLimit("t", 2, 1000, 1500), "limiteur : la fenêtre expire");
  }

  console.log("Admin : contrôle d'accès");
  {
    const id = firstRequestId;
    const calls = [
      ["GET", "/api/admin/beta-requests"],
      ["POST", `/api/admin/beta-requests/${id}/invite`],
      ["POST", `/api/admin/beta-requests/${id}/refuse`],
      ["POST", "/api/admin/signup-invites", { email: email("x") }],
    ];
    for (const [method, path, body] of calls) {
      const anon = await api(method, path, null, body);
      const user = await api(method, path, userCookie, body);
      check(anon.status === 401, `${method} ${path.replace(id, ":id")} sans session : 401`);
      check(user.status === 403, `${method} ${path.replace(id, ":id")} non-admin : 403`);
    }
    check((await prisma.signupInvite.count({ where: { email: email("zoe") } })) === 0, "aucun lien créé par un non-admin");
    check((await prisma.betaAccessRequest.findUnique({ where: { id } }))?.status === "pending", "demande intacte après les refus d'accès");
    const page = await fetch(`${BASE_URL}/admin`, { headers: { cookie: userCookie }, redirect: "manual" });
    check(page.status === 404, "/admin pour un non-admin : 404");
    const adminPage = await fetch(`${BASE_URL}/admin`, { headers: { cookie: adminCookie } });
    const html = await adminPage.text();
    check(adminPage.status === 200 && html.includes("Demandes d") , "/admin pour un admin : onglet « Demandes d'accès »");
    const list = await (await api("GET", "/api/admin/beta-requests", adminCookie)).json();
    const zoe = list.requests.find((r) => r.email === email("zoe"));
    check(!!zoe && zoe.status === "pending" && zoe.message === "Deuxième version" && zoe.createdAt, "liste admin : e-mail, prénom, message, date, statut");
  }

  console.log("Admin : accepter, régénérer, refuser");
  let zoeToken;
  {
    const id = firstRequestId;
    const accept = await api("POST", `/api/admin/beta-requests/${id}/invite`, adminCookie);
    const accepted = await accept.json();
    check(accept.status === 200 && accepted.link?.startsWith(`${BASE_URL}/register?invite=`), "accepter : renvoie un lien /register?invite=…");
    zoeToken = tokenOf(accepted.link);
    check(/^[A-Za-z0-9_-]{43}$/.test(zoeToken), "jeton : 32 octets aléatoires en base64url (43 caractères)");
    const row = await prisma.signupInvite.findFirst({ where: { email: email("zoe"), usedAt: null, revokedAt: null } });
    check(row?.tokenHash === sha(zoeToken) && row.tokenHash !== zoeToken, "seule l'empreinte SHA-256 est stockée");
    check(!(await prisma.$queryRawUnsafe(`SELECT 1 FROM "SignupInvite" WHERE "tokenHash" = $1 OR email = $1`, zoeToken)).length, "le jeton en clair n'est nulle part en base");
    const days = (row.expiresAt.getTime() - Date.now()) / 86400000;
    check(days > 13.99 && days <= 14.001, `valable 14 jours (${days.toFixed(3)} j)`);
    check(row.requestId === id && row.createdById === admin.id, "lié à la demande et à l'administrateur");
    check((await prisma.betaAccessRequest.findUnique({ where: { id } }))?.status === "invited", "statut de la demande : invitée");

    const regen = await (await api("POST", `/api/admin/beta-requests/${id}/invite`, adminCookie)).json();
    const newToken = tokenOf(regen.link);
    check(newToken !== zoeToken, "régénérer : un nouveau lien");
    const old = await register({ email: email("zoe"), invite: zoeToken });
    check(old.status === 403 && old.body?.error === INVITE_INVALID_MESSAGE, "l'ancien lien est invalidé (403)");
    check((await prisma.signupInvite.count({ where: { email: email("zoe"), usedAt: null, revokedAt: null } })) === 1, "un seul lien ouvert par adresse");
    zoeToken = newToken;

    const refuse = await api("POST", `/api/admin/beta-requests/${id}/refuse`, adminCookie);
    check(refuse.status === 200 && (await prisma.betaAccessRequest.findUnique({ where: { id } }))?.status === "refused", "refuser : statut refusée");
    const afterRefuse = await register({ email: email("zoe"), invite: newToken });
    check(afterRefuse.status === 403 && !(await prisma.user.findUnique({ where: { email: email("zoe") } })), "refuser invalide le lien en cours : inscription impossible");
    const again = await requestAccess({ email: email("zoe"), message: "Je reviens" });
    check(again.status === 200 && (await prisma.betaAccessRequest.findUnique({ where: { id } }))?.status === "refused", "une demande refusée n'est pas rouverte par un doublon");
    const reaccept = await api("POST", `/api/admin/beta-requests/${id}/invite`, adminCookie);
    zoeToken = tokenOf((await reaccept.json()).link);
    check(reaccept.status === 200 && (await prisma.betaAccessRequest.findUnique({ where: { id } }))?.status === "invited", "accepter après un refus : de nouveau invitée");

    check((await api("POST", "/api/admin/beta-requests/inconnu/invite", adminCookie)).status === 404, "demande inconnue : 404");

    const direct = await api("POST", "/api/admin/signup-invites", adminCookie, { email: `  Direct-${run}@Test.Local ` });
    const directBody = await direct.json();
    check(direct.status === 200 && directBody.email === email("direct") && directBody.link.includes("/register?invite="), "lien pour un e-mail sans demande préalable");
    check((await prisma.betaAccessRequest.count({ where: { email: email("direct") } })) === 0, "…sans créer de demande");
    check((await api("POST", "/api/admin/signup-invites", adminCookie, { email: "pas-un-mail" })).status === 400, "adresse invalide : 400");
    check((await api("POST", "/api/admin/signup-invites", adminCookie, { email: existingUser.toUpperCase() })).status === 409, "adresse qui a déjà un compte : 409");
    const directAgain = await (await api("POST", "/api/admin/signup-invites", adminCookie, { email: email("direct") })).json();
    check((await register({ email: email("direct"), invite: tokenOf(directBody.link) })).status === 403, "un nouveau lien direct invalide le précédent");
    check((await register({ email: email("direct"), invite: tokenOf(directAgain.link) })).status === 201, "…et le nouveau fonctionne");
  }

  console.log("Inscription par lien : jeton valide, à usage unique");
  {
    const id = firstRequestId;
    const page = await (await fetch(`${BASE_URL}/register?invite=${zoeToken}`)).text();
    check(page.includes("Créer mon compte") && page.includes(email("zoe")), "page /register?invite= valide : formulaire, e-mail pré-rempli");
    check(/<input[^>]*readOnly=""[^>]*value="[^"]*"|<input[^>]*value="[^"]*"[^>]*readOnly=""/.test(page.replace(/\n/g, " ")) || page.includes('readOnly=""'), "…et verrouillé (lecture seule)");
    check(!page.includes("Envoyer ma demande"), "…sans le formulaire de demande");

    const mismatch = await register({ email: email("autre"), invite: zoeToken });
    check(mismatch.status === 403 && mismatch.body?.error === INVITE_EMAIL_MISMATCH_MESSAGE, "autre e-mail avec ce lien : 403 « Utilise l'adresse à laquelle tu as été invité »");
    check(!(await prisma.user.findUnique({ where: { email: email("autre") } })), "…aucun compte créé");
    const short = await register({ email: email("zoe"), invite: zoeToken, password: "court" });
    check(short.status === 400, "mot de passe trop court : 400");
    check((await prisma.signupInvite.findFirst({ where: { tokenHash: sha(zoeToken) } }))?.usedAt === null, "…le lien n'est pas consommé par une saisie invalide");
    const noConsent = await register({ email: email("zoe"), invite: zoeToken, consent: false });
    check(noConsent.status === 400, "consentement absent : 400, lien non consommé");

    const ok = await register({ email: `ZOE-${run}@Test.Local`, invite: zoeToken });
    check(ok.status === 201, "e-mail invité (autre casse) : compte créé");
    const zoe = await prisma.user.findUnique({ where: { email: email("zoe") } });
    check(!!zoe && zoe.role === "user" && !!zoe.consentedAt, "adresse stockée en minuscules, rôle user, consentement enregistré");
    check(!!zoe && (await prisma.group.count({ where: { ownerId: zoe.id, isDefault: true } })) === 1, "groupe par défaut créé");
    const used = await prisma.signupInvite.findFirst({ where: { tokenHash: sha(zoeToken) } });
    check(!!used?.usedAt, "lien consommé à la création du compte");
    check((await prisma.betaAccessRequest.findUnique({ where: { id } }))?.status === "registered", "statut de la demande : inscrite");
    check(!!(await login(email("zoe"), "motdepasse-solide")), "le compte inscrit se connecte");

    const reuse = await register({ email: email("zoe"), invite: zoeToken });
    check(reuse.status === 403 || reuse.status === 409, `lien réutilisé : refusé (${reuse.status})`);
    const reuseOther = await register({ email: email("zoe2"), invite: zoeToken });
    check(reuseOther.status === 403 && !(await prisma.user.findUnique({ where: { email: email("zoe2") } })), "lien utilisé pour une autre adresse : refusé");
    const usedPage = await (await fetch(`${BASE_URL}/register?invite=${zoeToken}`)).text();
    check(usedPage.includes("Lien d&#x27;invitation invalide") || usedPage.includes("invitation invalide"), "page d'un lien déjà utilisé : message clair");
    check(usedPage.includes('href="/register"') && usedPage.includes("Demander un accès"), "…avec un lien vers la demande d'accès");
    check((await api("POST", `/api/admin/beta-requests/${id}/invite`, adminCookie)).status === 409, "accepter une demande déjà inscrite : 409");
    check((await api("POST", `/api/admin/beta-requests/${id}/refuse`, adminCookie)).status === 409, "refuser une demande déjà inscrite : 409");
    const accountsBefore = await prisma.user.count();
    check((await requestAccess({ email: email("zoe") })).status === 200 && (await prisma.user.count()) === accountsBefore, "demander un accès avec un compte existant ne change rien");
  }

  console.log("Jeton invalide, expiré, inconnu");
  {
    const expired = await issueInvite({ email: email("expire"), createdById: admin.id });
    await prisma.signupInvite.updateMany({ where: { tokenHash: sha(expired.token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await register({ email: email("expire"), invite: expired.token });
    check(r.status === 403 && r.body?.error === INVITE_INVALID_MESSAGE && !(await prisma.user.findUnique({ where: { email: email("expire") } })), "lien expiré : refusé, rien créé");
    const expiredPage = await (await fetch(`${BASE_URL}/register?invite=${expired.token}`)).text();
    check(expiredPage.includes("invitation invalide") && !expiredPage.includes("Créer mon compte"), "page d'un lien expiré : message clair, pas de formulaire");
    const unknown = await register({ email: email("inconnu"), invite: randomBytes(32).toString("base64url") });
    check(unknown.status === 403 && !(await prisma.user.findUnique({ where: { email: email("inconnu") } })), "jeton inconnu : refusé");
    const junk = await register({ email: email("inconnu"), invite: "x'; DROP TABLE \"User\"; --" });
    check(junk.status === 403, "jeton mal formé : refusé");
    check((await fetch(`${BASE_URL}/register?invite=`)).status === 200, "?invite= vide : page d'erreur, pas de plantage");
    const noInvite = await register({ email: email("expire") });
    check(noInvite.status === 403, "sans jeton ni liste blanche : fermé");
  }

  console.log("Course : deux inscriptions simultanées avec le même lien");
  {
    const raced = await issueInvite({ email: email("course"), createdById: admin.id });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => register({ email: i % 2 ? `COURSE-${run}@test.local` : email("course"), invite: raced.token }))
    );
    const created = results.filter((r) => r.status === 201).length;
    check(created === 1, `8 inscriptions simultanées : exactement un compte créé (${results.map((r) => r.status).join(",")})`);
    check((await prisma.user.count({ where: { email: { equals: email("course"), mode: "insensitive" } } })) === 1, "un seul utilisateur en base");
    check(results.every((r) => [201, 403, 409].includes(r.status)), "les autres sont refusés proprement (403 ou 409), pas d'erreur 500");
  }

  console.log("OAuth : invitation par cookie");
  {
    check(authOptions.providers.some((p) => p.id === "test-oidc"), "le fournisseur test-oidc est actif dans ce processus");
    const inv = await issueInvite({ email: email("oauth"), createdById: admin.id });

    const prep = await post("/api/signup-invite", { invite: inv.token });
    const setCookie = prep.res.headers.getSetCookie().join("; ");
    check(prep.status === 200 && setCookie.includes(`${INVITE_COOKIE.name}=${inv.token}`), "préparation : le cookie d'invitation est posé");
    check(/httponly/i.test(setCookie) && /path=\/api\/auth/i.test(setCookie) && /max-age=900/i.test(setCookie), "…httpOnly, limité à /api/auth, 15 minutes");
    check(/samesite=lax/i.test(setCookie), "…SameSite=Lax en HTTP (None + Secure en HTTPS, comme les cookies OAuth d'Apple)");
    check((await prisma.signupInvite.findFirst({ where: { tokenHash: sha(inv.token) } }))?.usedAt === null, "…et le lien n'est pas consommé à ce stade");
    const prepBad = await post("/api/signup-invite", { invite: "inconnu" });
    check(prepBad.status === 403 && prepBad.res.headers.getSetCookie().length === 0, "préparation avec un jeton invalide : 403, aucun cookie");

    const withCookie = authOptionsWithInvite(inv.token);
    const before = await prisma.user.count();
    check((await oauthSignIn(withCookie, email("oauth"))) === true, "cookie + e-mail invité vérifié : autorisé");
    check((await oauthSignIn(withCookie, `OAUTH-${run}@Test.Local`)) === true, "…quelle que soit la casse de l'e-mail du fournisseur");
    check((await oauthSignIn(authOptions, email("oauth"))) === SIGNUP_CLOSED_URL, "sans cookie : refusé (même e-mail invité)");
    check((await oauthSignIn(withCookie, email("oauth"), { verified: false })) === SIGNUP_CLOSED_URL, "A4 : email_verified=false : refusé");
    check((await oauthSignIn(withCookie, email("oauth"), { verified: "absent" })) === SIGNUP_CLOSED_URL, "A4 : email_verified absent : refusé");
    check((await oauthSignIn(withCookie, email("oauth"), { verified: "true" })) === true, "A4 : email_verified=\"true\" (Apple) : autorisé");
    check((await oauthSignIn(withCookie, email("pas-invite"))) === INVITE_EMAIL_MISMATCH_URL, "e-mail du fournisseur différent de l'invitation : refus avec message dédié");
    check(INVITE_EMAIL_MISMATCH_URL === "/login?error=InviteEmailMismatch" && oauthErrorMessage("InviteEmailMismatch") === INVITE_EMAIL_MISMATCH_MESSAGE, "…« Utilise l'adresse à laquelle tu as été invité » sur /login");
    check((await oauthSignIn(authOptionsWithInvite("inconnu"), email("oauth"))) === SIGNUP_CLOSED_URL, "cookie au jeton invalide : refusé");
    check((await prisma.user.count()) === before, "le callback signIn ne crée aucun utilisateur");

    let refused = false;
    try {
      await authOptionsWithInvite(inv.token).adapter.createUser({ email: email("pas-invite"), name: "Eve", emailVerified: null });
    } catch { refused = true; }
    check(refused && !(await prisma.user.findUnique({ where: { email: email("pas-invite") } })), "adaptateur : e-mail autre que l'invitation refusé, rien en base");
    let refusedNoToken = false;
    try { await authOptions.adapter.createUser({ email: email("oauth"), name: "Eve", emailVerified: null }); } catch { refusedNoToken = true; }
    check(refusedNoToken, "adaptateur : sans invitation, refusé");

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => withCookie.adapter.createUser({ email: email("oauth"), name: "Olivia", emailVerified: null }))
    );
    check(results.filter((r) => r.status === "fulfilled").length === 1, "course OAuth : un seul compte créé par le même lien");
    const created = await prisma.user.findUnique({ where: { email: email("oauth") } });
    check(!!created, "compte créé via l'adaptateur, adresse en minuscules");
    check(!!(await prisma.signupInvite.findFirst({ where: { tokenHash: sha(inv.token) } }))?.usedAt, "le lien est consommé à la création");
    check((await oauthSignIn(withCookie, email("oauth"))) === true, "ensuite l'e-mail est celui d'un compte existant : le callback laisse NextAuth refuser la liaison");
    let reused = false;
    try { await withCookie.adapter.createUser({ email: email("oauth"), name: "Bis", emailVerified: null }); } catch { reused = true; }
    check(reused, "lien réutilisé : refusé");
    const inv2 = await issueInvite({ email: email("oauth-b"), createdById: admin.id });
    check((await oauthSignIn(authOptionsWithInvite(inv.token), email("oauth-b"))) === SIGNUP_CLOSED_URL, "lien consommé d'une autre personne : ne donne rien pour une autre adresse");
    check((await oauthSignIn(authOptionsWithInvite(inv2.token), email("oauth-b"))) === true, "autre invitation, autre adresse : autorisée");
  }

  console.log("Liste blanche : toujours valable sans invitation");
  {
    // bob a déjà été créé par tests/signup.test.mjs (base partagée) : on repart d'une adresse libre.
    await prisma.user.deleteMany({ where: { email: email("bob") } });
    check((await oauthSignIn(authOptions, `BOB-${run}@Test.Local`)) === true, "adresse de la liste, e-mail vérifié : autorisée sans cookie");
    const created = await authOptions.adapter.createUser({ email: `Bob-${run}@Test.Local`, name: "Bob", emailVerified: null });
    check(!!created.id && !!(await prisma.user.findUnique({ where: { email: email("bob") } })), "…création en minuscules via l'adaptateur");
    const r = await register({ email: email("jamais-invite") });
    check(r.status === 403, "ni liste ni invitation : 403");
  }

  console.log("Conservation et suppression (RGPD)");
  {
    const old = new Date();
    old.setMonth(old.getMonth() - 7);
    await prisma.betaAccessRequest.create({ data: { email: email("ancienne"), name: "Vieille", consentVersion: "x", createdAt: old } });
    await prisma.betaAccessRequest.update({ where: { email: email("ancienne") }, data: { updatedAt: old } });
    await prisma.signupInvite.create({ data: { tokenHash: sha("vieux"), email: email("ancienne"), expiresAt: old, createdAt: old } });
    const recent = await prisma.betaAccessRequest.create({ data: { email: email("recente"), name: "Récente", consentVersion: "x" } });
    // Redéposée récemment (updatedAt récent) mais créée il y a 7 mois : la durée court depuis la création.
    await prisma.betaAccessRequest.create({ data: { email: email("redeposee"), name: "Redéposée", consentVersion: "x", createdAt: old, updatedAt: new Date() } });
    // Créée récemment, mise à jour il y a longtemps : conservée (la durée ne dépend plus d'updatedAt).
    await prisma.betaAccessRequest.create({ data: { email: email("maj-ancienne"), name: "Maj", consentVersion: "x" } });
    await prisma.betaAccessRequest.update({ where: { email: email("maj-ancienne") }, data: { updatedAt: old } });
    await purgeOldBetaData();
    check(!(await prisma.betaAccessRequest.findUnique({ where: { email: email("ancienne") } })), "demande de plus de 6 mois supprimée");
    check((await prisma.signupInvite.count({ where: { tokenHash: sha("vieux") } })) === 0, "invitation de plus de 6 mois supprimée");
    check(!(await prisma.betaAccessRequest.findUnique({ where: { email: email("redeposee") } })), "demande redéposée mais créée il y a 7 mois : supprimée (purge sur createdAt)");
    check(!!(await prisma.betaAccessRequest.findUnique({ where: { id: recent.id } })), "demande récente conservée");
    check(!!(await prisma.betaAccessRequest.findUnique({ where: { email: email("maj-ancienne") } })), "demande créée récemment conservée, quel que soit updatedAt");

    const leaving = await prisma.user.create({ data: { name: "Partante", email: email("partante"), password: hashPassword("mdp-partante"), consentedAt: new Date() } });
    await prisma.betaAccessRequest.create({ data: { email: email("partante"), name: "Partante", consentVersion: "x", status: "registered" } });
    await issueInvite({ email: email("partante"), createdById: admin.id });
    await deleteUserAccount(leaving.id, { keepShared: true });
    check((await prisma.betaAccessRequest.count({ where: { email: email("partante") } })) === 0 && (await prisma.signupInvite.count({ where: { email: email("partante") } })) === 0, "supprimer un compte efface sa demande et ses invitations");

    const creator = await prisma.user.create({ data: { name: "Créateur", email: email("createur"), role: "admin", consentedAt: new Date() } });
    await issueInvite({ email: email("orpheline"), createdById: creator.id });
    await deleteUserAccount(creator.id, { keepShared: true });
    const orphan = await prisma.signupInvite.findFirst({ where: { email: email("orpheline") } });
    check(!!orphan && orphan.createdById === null, "supprimer l'admin créateur ne supprime pas l'invitation (createdById à null)");
  }

  console.log("F5 / F3 : POST d'une autre origine refusés");
  {
    const id = (await prisma.betaAccessRequest.create({ data: { email: email("origine"), name: "Origine", consentVersion: "x" } })).id;
    const stored = (e) => prisma.betaAccessRequest.count({ where: { email: email(e) } });
    const evil = await post("/api/beta-requests", { name: "Zoé", consent: true, email: email("evil-origin") }, {});
    // `post` n'ajoute pas d'Origin : refaire la demande avec.
    const evilRes = await fetch(`${BASE_URL}/api/beta-requests`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: EVIL, "x-forwarded-for": freshIp() },
      body: JSON.stringify({ name: "Zoé", consent: true, email: email("evil-origin-2") }),
    });
    check(evil.status === 200 && evilRes.status === 403 && (await stored("evil-origin-2")) === 0, "/api/beta-requests : Origin étranger 403, rien stocké (sans Origin : accepté)");
    const nullRes = await fetch(`${BASE_URL}/api/beta-requests`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "null", "x-forwarded-for": freshIp() },
      body: JSON.stringify({ name: "Zoé", consent: true, email: email("evil-origin-3") }),
    });
    check(nullRes.status === 403, "…« Origin: null » (iframe sandboxée) : 403");
    const sameRes = await fetch(`${BASE_URL}/api/beta-requests`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL, "x-forwarded-for": freshIp() },
      body: JSON.stringify({ name: "Zoé", consent: true, email: email("same-origin") }),
    });
    check(sameRes.status === 200 && (await stored("same-origin")) === 1, "…Origin du site : accepté");

    const before = await prisma.signupInvite.count();
    const invite = await api("POST", `/api/admin/beta-requests/${id}/invite`, adminCookie, undefined, { origin: EVIL });
    const refuse = await api("POST", `/api/admin/beta-requests/${id}/refuse`, adminCookie, undefined, { origin: EVIL });
    const direct = await api("POST", "/api/admin/signup-invites", adminCookie, { email: email("evil-direct") }, { origin: EVIL });
    check(invite.status === 403 && refuse.status === 403 && direct.status === 403, "POST admin (inviter, refuser, lien direct) : Origin étranger 403 même avec la session admin");
    check((await prisma.signupInvite.count()) === before && (await prisma.betaAccessRequest.findUnique({ where: { id } }))?.status === "pending", "…aucun effet (pas de lien créé, demande intacte)");
    const ok = await api("POST", `/api/admin/beta-requests/${id}/invite`, adminCookie, undefined, { origin: BASE_URL });
    check(ok.status === 200, "POST admin avec l'Origin du site : accepté");
    const mobileLike = await api("POST", "/api/admin/signup-invites", adminCookie, { email: email("evil-direct") }, { origin: "null" });
    check(mobileLike.status === 403, "POST admin avec « Origin: null » : 403");

    const inv = await issueInvite({ email: email("f3"), createdById: admin.id });
    const plain = await fetch(`${BASE_URL}/api/signup-invite`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-forwarded-for": freshIp() },
      body: JSON.stringify({ invite: inv.token }),
    });
    check(plain.status === 415 && plain.headers.getSetCookie().length === 0, "/api/signup-invite : text/plain refusé (415), aucun cookie");
    const form = await fetch(`${BASE_URL}/api/signup-invite`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": freshIp() },
      body: `invite=${inv.token}`,
    });
    check(form.status === 415 && form.headers.getSetCookie().length === 0, "…formulaire HTML refusé aussi");
    const noType = await fetch(`${BASE_URL}/api/signup-invite`, { method: "POST", headers: { "x-forwarded-for": freshIp() }, body: JSON.stringify({ invite: inv.token }) });
    check(noType.status === 415, "…sans Content-Type : refusé");
    const evilInvite = await fetch(`${BASE_URL}/api/signup-invite`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: EVIL, "x-forwarded-for": freshIp() },
      body: JSON.stringify({ invite: inv.token }),
    });
    check(evilInvite.status === 403 && evilInvite.headers.getSetCookie().length === 0, "…Origin étranger : 403, aucun cookie");
    const good = await fetch(`${BASE_URL}/api/signup-invite`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", origin: BASE_URL, "x-forwarded-for": freshIp() },
      body: JSON.stringify({ invite: inv.token }),
    });
    check(good.status === 200 && good.headers.getSetCookie().some((c) => c.startsWith(INVITE_COOKIE.name)), "…JSON depuis l'origine du site : cookie posé");
  }

  console.log("F8 : corps trop gros refusé avant lecture");
  {
    const big = JSON.stringify({ name: "Zoé", consent: true, email: email("gros"), message: "x".repeat(9000) });
    const res = await fetch(`${BASE_URL}/api/beta-requests`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": freshIp() }, body: big });
    check(res.status === 413 && !(await prisma.betaAccessRequest.findUnique({ where: { email: email("gros") } })), "Content-Length > 8 Ko : 413, rien stocké");
    const edge = JSON.stringify({ name: "Zoé", consent: true, email: email("limite-corps"), message: "x".repeat(500) });
    const ok = await fetch(`${BASE_URL}/api/beta-requests`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": freshIp() }, body: edge });
    check(ok.status === 200, "un corps normal passe toujours");
  }

  console.log("F1 : plafond de demandes en attente");
  {
    const pendingNow = await prisma.betaAccessRequest.count({ where: { status: "pending" } });
    const previous = process.env.BETA_PENDING_CAP;
    process.env.BETA_PENDING_CAP = String(pendingNow + 1);
    const warns = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(" "));
    const fields = (label) => ({ email: email(label), name: "Plafond", message: "", consent: true });
    const a = await submitAccessRequest(fields("plafond-a"));
    const b = await submitAccessRequest(fields("plafond-b"));
    console.warn = originalWarn;
    if (previous === undefined) delete process.env.BETA_PENDING_CAP;
    else process.env.BETA_PENDING_CAP = previous;
    check(a.ok === true && b.ok === true && JSON.stringify(a) === JSON.stringify(b), "au-delà du plafond : même réponse { ok: true }");
    check(!!(await prisma.betaAccessRequest.findUnique({ where: { email: email("plafond-a") } })) && !(await prisma.betaAccessRequest.findUnique({ where: { email: email("plafond-b") } })), "…la dernière n'est pas stockée, la précédente l'est");
    check(warns.length === 1 && warns[0].includes("plafond") && !warns[0].includes(email("plafond-b")) && !warns[0].includes("@"), "…un avertissement journalisé, sans l'adresse");
    const after = await submitAccessRequest(fields("plafond-c"));
    check(after.ok === true && !!(await prisma.betaAccessRequest.findUnique({ where: { email: email("plafond-c") } })), "plafond par défaut (1000) : une demande normale est de nouveau stockée");
  }

  console.log("Liste admin : en attente d'abord, puis par date, paginée");
  {
    const base = new Date();
    const mk = (label, status, minutes) =>
      prisma.betaAccessRequest.create({ data: { email: email(label), name: label, consentVersion: "x", status, createdAt: new Date(base.getTime() - minutes * 60_000) } });
    await mk("liste-refusee-recente", "refused", 1);
    await mk("liste-attente-ancienne", "pending", 600);
    await mk("liste-invitee", "invited", 2);
    await mk("liste-attente-recente", "pending", 30);
    const all = await listBetaRequests({ limit: 500 });
    const firstNonPending = all.requests.findIndex((r) => r.status !== "pending");
    check(firstNonPending > 0 && all.requests.slice(firstNonPending).every((r) => r.status !== "pending"), "toutes les demandes en attente viennent avant les autres");
    const desc = (rows) => rows.every((r, i) => i === 0 || new Date(rows[i - 1].createdAt) >= new Date(r.createdAt));
    check(desc(all.requests.slice(0, firstNonPending)) && desc(all.requests.slice(firstNonPending)), "…puis par date décroissante dans chaque groupe");
    check(all.total === all.requests.length && all.pending === firstNonPending && all.hasMore === false, `total ${all.total}, ${all.pending} en attente, pas de suite`);
    const p1 = await listBetaRequests({ offset: 0, limit: 4 });
    const p2 = await listBetaRequests({ offset: 4, limit: 4 });
    check(p1.requests.length === 4 && p1.hasMore && JSON.stringify([...p1.requests, ...p2.requests]) === JSON.stringify(all.requests.slice(0, 8)), "pagination : deux pages consécutives = le début de la liste complète");
    const last = await listBetaRequests({ offset: all.total - 1, limit: 4 });
    check(last.requests.length === 1 && last.hasMore === false, "dernière page : une ligne, plus de suite");
    const crossing = await listBetaRequests({ offset: all.pending - 1, limit: 2 });
    check(crossing.requests[0].status === "pending" && crossing.requests[1].status !== "pending", "une page à cheval sur « en attente » / autres reste ordonnée");
    const viaApi = await (await api("GET", "/api/admin/beta-requests?offset=0&limit=3", adminCookie)).json();
    check(viaApi.requests.length === 3 && viaApi.total === all.total && viaApi.pending === all.pending && viaApi.hasMore === true, "API : offset, limit, total, pending, hasMore");
  }

  console.log("F7 : refuser ne touche jamais une demande inscrite");
  {
    const reg = await prisma.betaAccessRequest.create({ data: { email: email("f7-inscrite"), name: "Inscrite", consentVersion: "x", status: "registered" } });
    const open = await issueInvite({ email: email("f7-inscrite"), createdById: admin.id, requestId: reg.id });
    check((await refuseBetaRequest(reg.id)) === "registered", "demande inscrite : « registered »");
    const kept = await prisma.betaAccessRequest.findUnique({ where: { id: reg.id } });
    check(kept?.status === "registered", "…statut intact");
    check((await prisma.signupInvite.count({ where: { tokenHash: sha(open.token), revokedAt: null } })) === 1, "…et rien n'est révoqué");
    check((await refuseBetaRequest("inconnu")) === "not-found", "demande inconnue : not-found");
    // Course : le refus et la création du compte en même temps. Quel que soit l'ordre, si le
    // compte existe, la demande est « inscrite » (jamais « refusée »).
    let consistent = true;
    let accounts = 0;
    for (let i = 0; i < 8; i++) {
      const address = email(`f7-course-${i}`);
      const request = await prisma.betaAccessRequest.create({ data: { email: address, name: "Course", consentVersion: "x" } });
      const link = await issueInvite({ email: address, createdById: admin.id, requestId: request.id });
      await Promise.all([refuseBetaRequest(request.id), createUserWithGrant(address, { name: "Course" }, link.token)]);
      const user = await prisma.user.findUnique({ where: { email: address } });
      const status = (await prisma.betaAccessRequest.findUnique({ where: { id: request.id } }))?.status;
      if (user) accounts++;
      if (user ? status !== "registered" : status !== "refused") consistent = false;
    }
    check(consistent, `8 courses refus / inscription : le statut suit toujours l'existence du compte (${accounts} comptes créés)`);
  }

  console.log("F1 : limite globale toutes IP confondues");
  {
    const statuses = [];
    let retryAfter = null;
    for (let i = 0; i < 70; i++) {
      const r = await requestAccess({ email: email(`global-${i}`) });
      statuses.push(r.status);
      if (r.status === 429 && !retryAfter) retryAfter = r.res.headers.get("retry-after");
    }
    const firstLimited = statuses.indexOf(429);
    check(firstLimited > 0 && statuses.slice(firstLimited).every((st) => st === 429), `60 par heure, toutes IP : 429 dès la ${firstLimited + 1}e demande de la série puis jusqu'à la fin`);
    check(retryAfter === "3600", "…avec Retry-After");
    check((await requestAccess({ email: email("global-autre-ip") })).status === 429, "…même depuis une IP jamais vue");
    check((await prisma.betaAccessRequest.count({ where: { email: { startsWith: "global-" } } })) === firstLimited, "…et les demandes limitées ne sont pas stockées");
  }

  console.log("RGPD : suppression d'une demande ou d'un lien direct depuis l'admin");
  {
    const del = (path, cookie, headers) => api("DELETE", path, cookie, undefined, headers);
    const mk = async (label, status = "pending") =>
      prisma.betaAccessRequest.create({ data: { email: email(label), name: "Suppr", consentVersion: "x", status } });
    const probe = await mk("suppr-droits");
    const noCookie = await del(`/api/admin/beta-requests/${probe.id}`);
    const asUser = await del(`/api/admin/beta-requests/${probe.id}`, userCookie);
    check(noCookie.status === 401 || noCookie.status === 403, "DELETE sans session : refusé");
    check(asUser.status === 403, "DELETE par un non-admin : 403");
    const evil = await del(`/api/admin/beta-requests/${probe.id}`, adminCookie, { origin: EVIL });
    const evilNull = await del(`/api/admin/beta-requests/${probe.id}`, adminCookie, { origin: "null" });
    check(evil.status === 403 && evilNull.status === 403, "DELETE avec Origin étranger (ou null), même admin : 403");
    check(!!(await prisma.betaAccessRequest.findUnique({ where: { id: probe.id } })), "…la demande est intacte");
    check((await del("/api/admin/beta-requests/inconnu", adminCookie)).status === 404, "id inconnu : 404");

    // Demande invitée : la demande et ses liens (par requestId ET par adresse) disparaissent.
    const invited = await mk("suppr-invitee");
    const link = await issueInvite({ email: invited.email, createdById: admin.id, requestId: invited.id });
    const stray = await prisma.signupInvite.create({
      data: { tokenHash: sha(randomBytes(8).toString("hex")), email: invited.email, expiresAt: new Date(Date.now() + 1e6), requestId: null },
    });
    const ok = await del(`/api/admin/beta-requests/${invited.id}`, adminCookie, { origin: BASE_URL });
    check(ok.status === 200, "DELETE par l'admin (Origin du site) : 200");
    check(!(await prisma.betaAccessRequest.findUnique({ where: { id: invited.id } })), "…la demande n'existe plus");
    check((await prisma.signupInvite.count({ where: { OR: [{ email: invited.email }, { requestId: invited.id }, { id: stray.id }] } })) === 0, "…ni ses invitations (par demande et par adresse)");
    const reuse = await register({ name: "Suppr", email: invited.email, invite: link.token });
    check(reuse.status !== 200 && reuse.status !== 201 && !(await prisma.user.findUnique({ where: { email: invited.email } })), "…le lien supprimé ne permet plus de créer un compte");
    check((await del(`/api/admin/beta-requests/${invited.id}`, adminCookie)).status === 404, "…une seconde suppression : 404");
    check((await findValid(link.token)) === null, "…findValidInvite ne le reconnaît plus");

    // Tous les statuts.
    let allGone = true;
    for (const st of ["pending", "refused"]) {
      const r = await mk(`suppr-${st}`, st);
      const res = await del(`/api/admin/beta-requests/${r.id}`, adminCookie);
      if (res.status !== 200 || (await prisma.betaAccessRequest.findUnique({ where: { id: r.id } }))) allGone = false;
    }
    check(allGone, "statuts pending et refused : supprimés");

    // Inscrite : le compte (et ce qu'il contient) reste (ADR 0001).
    const regEmail = email("suppr-inscrite");
    const regReq = await mk("suppr-inscrite");
    const regLink = await issueInvite({ email: regEmail, createdById: admin.id, requestId: regReq.id });
    const created = await createUserWithGrant(regEmail, { name: "Inscrite" }, regLink.token);
    const todo = await prisma.todo.create({ data: { title: "Reste visible", userId: created.user.id } });
    check((await prisma.betaAccessRequest.findUnique({ where: { id: regReq.id } }))?.status === "registered", "demande « registered » avant suppression");
    const regDel = await del(`/api/admin/beta-requests/${regReq.id}`, adminCookie);
    check(regDel.status === 200 && !(await prisma.betaAccessRequest.findUnique({ where: { id: regReq.id } })), "demande registered : supprimée");
    check((await prisma.signupInvite.count({ where: { email: regEmail } })) === 0, "…avec ses invitations");
    check(!!(await prisma.user.findUnique({ where: { id: created.user.id } })), "…mais le compte existe toujours (ADR 0001)");
    check(!!(await prisma.todo.findFirst({ where: { id: todo.id, userId: created.user.id } })), "…et son contenu reste attaché à son auteur");
    check((await createUserWithGrant(regEmail, { name: "Bis" }, undefined)).ok === false, "…et l'adresse reste prise (pas de second compte)");

    // Liens directs (sans demande).
    const directEmail = email("suppr-direct");
    const d1 = await issueInvite({ email: directEmail, createdById: admin.id });
    const d2 = await issueInvite({ email: directEmail, createdById: admin.id });
    const otherDirect = await issueInvite({ email: email("suppr-direct-autre"), createdById: admin.id });
    const page = await listBetaRequests();
    const entry = page.directInvites.find((d) => d.email === directEmail);
    check(!!entry && entry.status === "active" && page.directInvites.filter((d) => d.email === directEmail).length === 1, "liste admin : un lien direct par adresse, le plus récent en cours");
    check(!page.directInvites.some((d) => d.email === invited.email), "…sans les invitations rattachées à une demande");
    check((await del(`/api/admin/signup-invites/${entry.id}`, adminCookie, { origin: EVIL })).status === 403, "DELETE lien direct : Origin étranger 403");
    check((await del(`/api/admin/signup-invites/${entry.id}`, userCookie)).status === 403, "…non-admin 403");
    check((await del("/api/admin/signup-invites/inconnu", adminCookie)).status === 404, "…id inconnu 404");
    const viaRequest = await prisma.signupInvite.create({
      data: { tokenHash: sha(randomBytes(8).toString("hex")), email: email("suppr-rattache"), expiresAt: new Date(Date.now() + 1e6), requestId: (await mk("suppr-rattache")).id },
    });
    check((await del(`/api/admin/signup-invites/${viaRequest.id}`, adminCookie)).status === 404, "…invitation rattachée à une demande : 404 (passer par la demande)");
    const delDirect = await del(`/api/admin/signup-invites/${entry.id}`, adminCookie, { origin: BASE_URL });
    check(delDirect.status === 200, "lien direct supprimé : 200");
    check((await prisma.signupInvite.count({ where: { email: directEmail } })) === 0, "…tous les liens directs de l'adresse disparaissent (ancien et récent)");
    check((await findValid(d1.token)) === null && (await findValid(d2.token)) === null, "…et ne marchent plus");
    check((await findValid(otherDirect.token)) !== null, "…le lien d'une autre adresse reste valide");
    check(![200, 201].includes((await register({ name: "Direct", email: directEmail, invite: d2.token })).status), "…inscription avec le lien supprimé refusée");
    check((await deleteDirectInvites("inconnu")) === "not-found" && (await deleteBetaRequest("inconnu")) === "not-found", "fonctions : id inconnu = not-found");

    // Course suppression / inscription : pas d'interblocage (verrou par adresse), cohérence.
    let consistent = true;
    let accounts = 0;
    const started = Date.now();
    for (let i = 0; i < 10; i++) {
      const address = email(`suppr-course-${i}`);
      const request = await prisma.betaAccessRequest.create({ data: { email: address, name: "Course", consentVersion: "x" } });
      const lk = await issueInvite({ email: address, createdById: admin.id, requestId: request.id });
      const del1 = () => deleteBetaRequest(request.id);
      const add1 = () => createUserWithGrant(address, { name: "Course" }, lk.token);
      // Départ dans les deux ordres, pour exercer « suppression d'abord » et « inscription d'abord ».
      const [deleted, created2] = i % 2 ? await Promise.all([del1(), add1()]) : (await Promise.all([add1(), del1()])).reverse();
      const user = await prisma.user.findUnique({ where: { email: address } });
      const left = await prisma.betaAccessRequest.findUnique({ where: { id: request.id } });
      const invitesLeft = await prisma.signupInvite.count({ where: { email: address } });
      if (user) accounts++;
      // Quel que soit l'ordre : plus de demande ni d'invitation après la suppression ; le
      // compte, s'il a été créé, reste.
      if (deleted !== "ok" || left || invitesLeft !== 0 || (created2.ok && !user)) consistent = false;
    }
    check(consistent, `10 courses suppression / inscription : aucune erreur, aucun reste, compte conservé s'il a été créé (${accounts} comptes, ${Date.now() - started} ms, sans interblocage)`);
  }

  console.log("Invariants");
  {
    check((await prisma.user.count({ where: { email: { in: [email("autre"), email("inconnu"), email("expire"), email("zoe2"), email("jamais-invite"), email("pas-invite")] } } })) === 0, "aucune adresse refusée n'a obtenu de compte");
    check((await prisma.user.count({ where: { email: { startsWith: "reg-rate" } } })) === 0, "aucun compte créé par les essais limités");
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
