/**
 * Invitation de foyer (/groups/join/<jeton>) qui ouvre AUSSI l'inscription, puis ramène au
 * groupe (src/lib/groupInviteSignup.ts, createUserWithGrant). Lien ouvert : UNE seule
 * inscription par lien. Lien nominatif : seule son adresse. Expiré, utilisé, supprimé : refusé.
 * Sans invitation : toujours fermé. `callbackUrl` : chemin interne uniquement.
 *
 * Lancé par scripts/test-signup.sh (base JETABLE). Les adresses autorisées sont en base
 * (table AllowedSignupEmail), semées ici.
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
process.env.NEXTAUTH_URL = BASE_URL;

const unwrap = (mod) => ({ ...mod.default, ...mod });
const { authOptionsWithInvite, SIGNUP_CLOSED_URL } = unwrap(await import("../src/lib/auth.ts"));
const { INVITE_EMAIL_MISMATCH_URL, INVITE_EMAIL_MISMATCH_MESSAGE, createUserWithGrant } = unwrap(await import("../src/lib/signupInvite.ts"));
const { GROUP_INVITE_INVALID_MESSAGE, GROUP_INVITE_COOKIE } = unwrap(await import("../src/lib/groupInviteSignup.ts"));
const { safeCallbackPath } = unwrap(await import("../src/lib/safeCallback.ts"));
const { hashPassword } = unwrap(await import("../src/lib/password.ts"));
const { deleteUserAccount } = unwrap(await import("../src/lib/account.ts"));

const prisma = new PrismaClient();
let failures = 0;
let checks = 0;
const check = (cond, label) => {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
};

let ipCounter = 0;
const freshIp = () => `10.7.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const email = (label) => `${label}-${run}@test.local`;
/** Adresse autorisée à s'inscrire sans lien (table AllowedSignupEmail, forme normalisée). */
const allow = (address) => {
  const normalized = address.trim().toLowerCase();
  return prisma.allowedSignupEmail.upsert({ where: { email: normalized }, create: { email: normalized }, update: {} });
};
const newToken = () => randomBytes(24).toString("base64url");

async function post(path, body, { ip = freshIp(), cookie } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { res, status: res.status, body: await res.json().catch(() => null) };
}
const register = (fields, opts) =>
  post("/api/auth/register", { name: "Invité", password: "motdepasse-solide", consent: true, ...fields }, opts);

async function login(address, password) {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, email: address, password, json: "true" }).toString(),
  });
  const session = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.includes("next-auth.session-token="));
  return session ? [csrfCookie, session].join("; ") : null;
}

const oauthSignIn = (options, address) => {
  const id = `sub-${randomBytes(4).toString("hex")}`;
  return options.callbacks.signIn({
    user: { id, email: address, name: "Invité" },
    account: { provider: "test-oidc", type: "oauth", providerAccountId: id },
    profile: { email: address, email_verified: true },
  });
};

async function main() {
  for (const label of ["alice", "bob", "kelly"]) await allow(email(label));
  const owner = await prisma.user.create({
    data: { name: "Maître", email: email("maitre-foyer"), password: hashPassword("mdp-maitre"), consentedAt: new Date() },
  });
  const group = await prisma.group.create({
    data: { name: `Foyer ${run}`, ownerId: owner.id, members: { create: { userId: owner.id, role: "admin" } } },
  });
  const mkInvite = (data = {}) =>
    prisma.groupInvite.create({
      data: { groupId: group.id, token: newToken(), expiresAt: new Date(Date.now() + 7 * 86_400_000), ...data },
    });
  const claimed = async (token) => (await prisma.groupInvite.findUnique({ where: { token } }))?.signupClaimedAt;
  const userOf = (address) => prisma.user.findUnique({ where: { email: address } });

  console.log("Sans invitation : toujours fermé");
  {
    const open = await mkInvite();
    check((await register({ email: email("ferme-1") })).status === 403, "ni adresse autorisée ni invitation : 403");
    const unknown = await register({ email: email("ferme-2"), groupInvite: newToken() });
    check(unknown.status === 403 && unknown.body?.error === GROUP_INVITE_INVALID_MESSAGE, "jeton de foyer inconnu : 403");
    check((await register({ email: email("ferme-3"), groupInvite: "court" })).status === 403, "jeton mal formé : 403");
    check((await register({ email: email("ferme-4"), groupInvite: { $ne: 1 } })).status === 403, "jeton non textuel : 403");
    check((await register({ email: email("ferme-5"), invite: open.token })).status === 403, "un jeton de foyer donné comme invitation bêta : 403");
    check(
      (await prisma.user.count({ where: { email: { in: [1, 2, 3, 4, 5].map((n) => email(`ferme-${n}`)) } } })) === 0 && !(await claimed(open.token)),
      "aucun compte créé, le lien n'est pas entamé"
    );
  }

  console.log("Lien ouvert : inscription, retour au groupe, adhésion");
  const open = await mkInvite();
  {
    const info = await (await fetch(`${BASE_URL}/api/groups/join/${open.token}`)).json();
    check(info.groupName === group.name && info.signupAllowed === true && info.inviteEmail === null, "GET du lien : groupe, inscription permise, pas d'adresse imposée");
    const page = await (await fetch(`${BASE_URL}/register?groupInvite=${open.token}`)).text();
    check(page.includes("Créer mon compte") && page.includes(group.name), "page /register?groupInvite= : formulaire au nom du groupe");
    const r = await register({ email: `Nouveau-${run}@Test.Local`, groupInvite: open.token });
    check(r.status === 201, `inscription avec un lien de foyer ouvert (${r.status})`);
    const user = await userOf(email("nouveau"));
    check(!!user && !!user.password && !!user.consentedAt, "compte créé (adresse en minuscules, consentement enregistré)");
    check(!!(await claimed(open.token)), "le lien est marqué « inscription faite »");
    const stored = await prisma.groupInvite.findUnique({ where: { token: open.token } });
    check(stored.usedAt === null, "…mais pas consommé pour rejoindre : le retour au groupe reste possible");
    check(!(await prisma.groupMember.findFirst({ where: { groupId: group.id, userId: user.id } })), "pas encore membre avant la page du groupe");
    check(!!(await prisma.group.findFirst({ where: { ownerId: user.id, isDefault: true } })), "son groupe par défaut est créé");

    const cookie = await login(email("nouveau"), "motdepasse-solide");
    check(!!cookie, "connexion avec le compte créé");
    const join = await fetch(`${BASE_URL}/api/groups/join/${open.token}`, { method: "POST", headers: { cookie } });
    check(join.status === 200, `adhésion via le flux existant (${join.status})`);
    const member = await prisma.groupMember.findFirst({ where: { groupId: group.id, userId: user.id } });
    check(member?.role === "member", "rôle « member », comme n'importe quel invité");
    check(!!(await prisma.groupInvite.findUnique({ where: { token: open.token } })).usedAt, "le lien est consommé par l'adhésion");
  }

  console.log("Limite d'usage d'un lien ouvert");
  {
    const link = await mkInvite();
    const first = await register({ email: email("usage-1"), groupInvite: link.token });
    const second = await register({ email: email("usage-2"), groupInvite: link.token });
    check(first.status === 201 && second.status === 403 && second.body?.error === GROUP_INVITE_INVALID_MESSAGE, `un seul compte par lien (${first.status}, puis ${second.status})`);
    check(!(await userOf(email("usage-2"))), "la deuxième adresse n'a pas de compte");
    const info = await (await fetch(`${BASE_URL}/api/groups/join/${link.token}`)).json();
    check(info.signupAllowed === false, "GET du lien : inscription plus permise");

    // Course : 6 inscriptions simultanées sur un même lien ouvert, un seul compte.
    const race = await mkInvite();
    const results = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => register({ email: email(`gi-course-${n}`), groupInvite: race.token })));
    const created = await prisma.user.count({ where: { email: { startsWith: `gi-course-`, endsWith: `-${run}@test.local` } } });
    check(results.filter((r) => r.status === 201).length === 1 && created === 1, `6 inscriptions simultanées : 1 compte (${results.map((r) => r.status).join(",")})`);

    // Création directe (OAuth) : même règle atomique.
    const direct = await mkInvite();
    const a = await createUserWithGrant(email("direct-a"), { name: "A" }, undefined, direct.token);
    const b = await createUserWithGrant(email("direct-b"), { name: "B" }, undefined, direct.token);
    check(a.ok === true && b.ok === false && b.reason === "closed", "createUserWithGrant : le second est refusé");
  }

  console.log("Lien expiré, déjà utilisé ou supprimé : refusé");
  {
    const expired = await mkInvite({ expiresAt: new Date(Date.now() - 1000) });
    const used = await mkInvite({ usedAt: new Date() });
    const revoked = await mkInvite();
    await prisma.groupInvite.delete({ where: { id: revoked.id } });
    for (const [label, link] of [["expiré", expired], ["déjà utilisé pour rejoindre", used], ["supprimé", revoked]]) {
      const r = await register({ email: email(`refus-${link.id.slice(-6)}`), groupInvite: link.token });
      check(r.status === 403 && r.body?.error === GROUP_INVITE_INVALID_MESSAGE, `lien ${label} : 403`);
      check((await fetch(`${BASE_URL}/register?groupInvite=${link.token}`).then((x) => x.text())).includes("Ce lien ne fonctionne plus"), `page d'inscription du lien ${label} : « Ce lien ne fonctionne plus »`);
    }
    check((await prisma.user.count({ where: { email: { startsWith: "refus-" } } })) === 0, "aucun compte créé");
    // Un groupe supprimé emporte ses liens (cascade) : le lien ne donne plus rien.
    const doomedGroup = await prisma.group.create({ data: { name: `Éphémère ${run}`, ownerId: owner.id } });
    const doomed = await prisma.groupInvite.create({ data: { groupId: doomedGroup.id, token: newToken(), expiresAt: new Date(Date.now() + 86_400_000) } });
    await prisma.group.delete({ where: { id: doomedGroup.id } });
    check((await register({ email: email("refus-groupe"), groupInvite: doomed.token })).status === 403, "groupe supprimé : lien inutilisable");
  }

  console.log("Lien nominatif");
  {
    const named = await mkInvite({ email: `Cible-${run}@Test.Local` });
    const info = await (await fetch(`${BASE_URL}/api/groups/join/${named.token}`)).json();
    check(info.inviteEmail === email("cible"), "GET du lien : adresse imposée (normalisée)");
    const other = await register({ email: email("autre-adresse"), groupInvite: named.token });
    check(other.status === 403 && other.body?.error === INVITE_EMAIL_MISMATCH_MESSAGE, "autre adresse : refusée avec le message d'adresse");
    check(!(await userOf(email("autre-adresse"))) && !(await claimed(named.token)), "…sans compte, et le lien n'est pas entamé");
    const good = await register({ email: `CIBLE-${run}@test.local`, groupInvite: named.token });
    check(good.status === 201 && !!(await userOf(email("cible"))), `bonne adresse (casse différente) : compte créé (${good.status})`);
    check((await register({ email: email("cible"), groupInvite: named.token })).status === 403, "le lien nominatif ne sert qu'une fois");
  }

  console.log("Compte existant, liste blanche");
  {
    const link = await mkInvite();
    const exists = await register({ email: email("maitre-foyer"), groupInvite: link.token });
    check(exists.status === 409 && !(await claimed(link.token)), "adresse déjà inscrite : 409, le lien n'est pas entamé");
    // Les tests précédents ont pu créer cette adresse de la liste : on repart d'une base sans elle.
    const bob = await userOf(`bob-${run}@test.local`);
    if (bob) await deleteUserAccount(bob.id, { keepShared: true });
    // La suppression d'un compte retire aussi son adresse de la table (RGPD) : on la remet.
    await allow(email("bob"));
    const listed = await register({ email: `bob-${run}@test.local`, groupInvite: link.token });
    check(listed.status === 201 && !(await claimed(link.token)), "adresse autorisée (table) : compte créé sans entamer le lien");
  }

  console.log("Google / Apple : cookie de lien de foyer");
  {
    const link = await mkInvite();
    const prep = await post("/api/signup-invite", { groupInvite: link.token });
    const set = prep.res.headers.getSetCookie().join("; ");
    check(prep.status === 200 && set.includes(`${GROUP_INVITE_COOKIE.name}=${link.token}`) && /httponly/i.test(set) && set.includes("Path=/api/auth"), "lien valide : cookie httpOnly limité à /api/auth");
    check((await post("/api/signup-invite", { groupInvite: newToken() })).status === 403, "lien inconnu : pas de cookie");

    const withCookie = authOptionsWithInvite(undefined, link.token);
    check((await oauthSignIn(withCookie, email("oauth-1"))) === true, "cookie de lien ouvert valide : première connexion acceptée");
    const created = await withCookie.adapter.createUser({ email: email("oauth-1"), name: "Oscar", emailVerified: new Date() });
    check(!!created.id && !!(await claimed(link.token)), "création par l'adaptateur : compte créé, lien marqué");
    check((await oauthSignIn(withCookie, email("oauth-2"))) === SIGNUP_CLOSED_URL, "même lien, autre personne : fermé");
    let refused = false;
    try { await withCookie.adapter.createUser({ email: email("oauth-2"), name: "Zed", emailVerified: new Date() }); } catch { refused = true; }
    check(refused && !(await userOf(email("oauth-2"))), "…et l'adaptateur ne crée rien");

    const named = await mkInvite({ email: email("oauth-nom") });
    check((await oauthSignIn(authOptionsWithInvite(undefined, named.token), email("oauth-3"))) === INVITE_EMAIL_MISMATCH_URL, "lien nominatif, autre adresse : message d'adresse");
    check((await oauthSignIn(authOptionsWithInvite(undefined, named.token), email("oauth-nom"))) === true, "lien nominatif, bonne adresse : acceptée");
    check((await oauthSignIn(authOptionsWithInvite(undefined, undefined), email("oauth-4"))) === SIGNUP_CLOSED_URL, "sans cookie : fermé");
    check((await oauthSignIn(authOptionsWithInvite(undefined, "inconnu"), email("oauth-4"))) === SIGNUP_CLOSED_URL, "cookie invalide : fermé");
  }

  console.log("callbackUrl : chemin interne uniquement");
  {
    const bad = ["https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "javascript:alert(1)", "evil.example", "", null, undefined, 42, "/ok\u0000/x"];
    check(bad.every((v) => safeCallbackPath(v) === "/"), "URL externe, // , \\, tabulation, retour à la ligne, javascript: : ignorés (retour à « / »)");
    check(safeCallbackPath("https://evil.example", "/groups") === "/groups", "valeur de repli personnalisée");
    check(safeCallbackPath("/groups/join/abc_DEF-123") === "/groups/join/abc_DEF-123" && safeCallbackPath("/recipes?x=1#a") === "/recipes?x=1#a", "chemins internes conservés");
  }

  console.log("Rejoindre un groupe : lien à usage unique, atomique");
  {
    const joinAs = async (address) => {
      await prisma.user.create({
        data: { name: address, email: address, password: hashPassword("mdp-joueur"), consentedAt: new Date() },
      });
      return login(address, "mdp-joueur");
    };
    const postJoin = (token, cookie) => fetch(`${BASE_URL}/api/groups/join/${token}`, { method: "POST", headers: { cookie } });
    const members = (userId) => prisma.groupMember.count({ where: { groupId: group.id, userId } });

    // Course : 8 personnes différentes, un seul lien à usage unique, tous en même temps.
    const link = await mkInvite();
    const names = Array.from({ length: 8 }, (_, i) => email(`course-${i}`));
    const cookies = await Promise.all(names.map(joinAs));
    check(cookies.every(Boolean), "8 sessions de test");
    const results = await Promise.all(cookies.map((c) => postJoin(link.token, c)));
    const codes = results.map((r) => r.status).sort();
    const ids = (await prisma.user.findMany({ where: { email: { in: names } }, select: { id: true } })).map((u) => u.id);
    const total = await prisma.groupMember.count({ where: { groupId: group.id, userId: { in: ids } } });
    check(codes.filter((c) => c === 200).length === 1 && codes.filter((c) => c === 410).length === 7, `8 joins simultanés d'un lien à usage unique : 1 seul 200, 7 refus 410 (${codes.join(",")})`);
    check(total === 1, `une seule adhésion créée (${total})`);
    check(!!(await prisma.groupInvite.findUnique({ where: { token: link.token } })).usedAt, "le lien est consommé");

    // Même personne, deux onglets : une adhésion, pas d'erreur 500.
    const again = await mkInvite();
    const twice = await joinAs(email("deux-onglets"));
    const pair = await Promise.all([postJoin(again.token, twice), postJoin(again.token, twice)]);
    const uid = (await userOf(email("deux-onglets"))).id;
    check(pair.every((r) => r.status === 200 || r.status === 410) && pair.some((r) => r.status === 200), `même personne, deux requêtes : pas de 500 (${pair.map((r) => r.status).join(",")})`);
    check((await members(uid)) === 1, "une seule adhésion pour elle");

    // Expiré ou déjà utilisé : refusé, aucune adhésion.
    const expired = await mkInvite({ expiresAt: new Date(Date.now() - 1000) });
    const used = await mkInvite({ usedAt: new Date() });
    const late = await joinAs(email("en-retard"));
    const lateId = (await userOf(email("en-retard"))).id;
    check((await postJoin(expired.token, late)).status === 410 && (await postJoin(used.token, late)).status === 410, "lien expiré ou déjà utilisé : 410");
    check((await postJoin(newToken(), late)).status === 404, "lien inconnu : 404");
    check((await members(lateId)) === 0, "aucune adhésion créée");
    // Hors périmètre (noté, non changé) : un lien nominatif n'impose pas l'adresse au join.
  }

  console.log("Limite de débit");
  {
    const ip = freshIp();
    const link = await mkInvite();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await register({ email: email(`debit-${i}`), groupInvite: newToken() }, { ip })).status;
    check(last === 429, `inscriptions au-delà de 10 essais depuis une IP : 429 (${last})`);
    const stillOpen = !(await claimed(link.token));
    check(stillOpen && (await prisma.user.count({ where: { email: { startsWith: "debit-" } } })) === 0, "aucun compte créé par les essais limités");
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
