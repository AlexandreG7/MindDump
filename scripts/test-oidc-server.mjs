/**
 * Serveur OIDC minimal pour le fournisseur de test `test-oidc` (src/lib/authProviders.ts,
 * docs/oauth.md « Tester sans Google ni Apple »). Sans dépendance : node scripts/test-oidc-server.mjs
 *
 * - Imite Apple : retour en POST (response_mode=form_post), id_token RS256.
 * - Page d'autorisation avec un bouton par compte de test, « Annuler » (access_denied).
 *   Avec ?auto ou OIDC_AUTO=1, le compte « courant » est accepté sans clic.
 * - Compte courant : GET /__subject?sub=test-a&email=a@test.local&name=Alice
 *
 * Variables : PORT (défaut 4010), ISSUER (défaut http://localhost:PORT, même site que le serveur de dev : les cookies Lax suivent le POST du retour), OIDC_AUTO.
 * Client : minddump-test / minddump-test-secret. JAMAIS en production.
 */
import { createServer } from "node:http";
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";

const PORT = Number(process.env.PORT || 4010);
const ISSUER = process.env.ISSUER || `http://localhost:${PORT}`;
const CLIENT_ID = "minddump-test";
const KID = "test-key-1";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, use: "sig", alg: "RS256" };

const ACCOUNTS = {
  "test-a": { email: "oidc-a@test.local", name: "Alice (test)" },
  "test-b": { email: "oidc-b@test.local", name: "Bruno (test)" },
};
let current = { sub: "test-a", ...ACCOUNTS["test-a"] };
const codes = new Map();

const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function idToken(account, nonce) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "RS256", kid: KID, typ: "JWT" })}.${b64({
    iss: ISSUER, aud: CLIENT_ID, iat: now, exp: now + 300, nonce,
    sub: account.sub, email: account.email, name: account.name,
  })}`;
  const sig = createSign("RSA-SHA256").update(body).sign(privateKey).toString("base64url");
  return `${body}.${sig}`;
}

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const readBody = (req) => new Promise((resolve) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => resolve(new URLSearchParams(data)));
});
const html = (res, body) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:-apple-system,sans-serif;padding:24px;max-width:420px;margin:auto">${body}`);
};

// Formulaire renvoyé vers le redirect_uri de MindDump (form_post).
function postBack(redirectUri, fields, auto) {
  const inputs = Object.entries(fields).filter(([, v]) => v !== "").map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
  return `<form id="f" method="post" action="${esc(redirectUri)}">${inputs}<button style="width:100%;padding:14px;font-size:17px">Continuer</button></form>${auto ? "<script>document.getElementById('f').submit()</script>" : ""}`;
}

createServer(async (req, res) => {
  const url = new URL(req.url, ISSUER);
  const json = (obj, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (url.pathname === "/.well-known/openid-configuration") {
    return json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
      response_types_supported: ["code"],
      response_modes_supported: ["form_post", "query"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      scopes_supported: ["openid", "email", "profile"],
      code_challenge_methods_supported: ["S256"],
    });
  }
  if (url.pathname === "/jwks") return json({ keys: [jwk] });

  if (url.pathname === "/__subject") {
    const sub = url.searchParams.get("sub") || "test-a";
    const known = ACCOUNTS[sub] || {};
    current = {
      sub,
      email: url.searchParams.get("email") || known.email || `${sub}@test.local`,
      name: url.searchParams.get("name") || known.name || sub,
    };
    return json(current);
  }

  if (url.pathname === "/authorize") {
    const p = url.searchParams;
    if (p.get("client_id") !== CLIENT_ID || !p.get("redirect_uri")) return json({ error: "invalid_request" }, 400);
    const auto = p.has("auto") || process.env.OIDC_AUTO === "1";
    const state = p.get("state") || "";
    const redirect = p.get("redirect_uri");
    const approve = (account) => {
      const code = randomBytes(16).toString("hex");
      codes.set(code, { account, nonce: p.get("nonce") || undefined, challenge: p.get("code_challenge") });
      return postBack(redirect, { code, state }, auto);
    };
    if (auto) return html(res, approve(current));
    // Interactif : un bouton par compte (chaque bouton est un formulaire vers ce serveur).
    const form = (label, sub) =>
      `<form method="get" action="/approve" style="margin:10px 0"><input type="hidden" name="sub" value="${sub}">` +
      [...p].map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("") +
      `<button style="width:100%;min-height:48px;font-size:17px">${esc(label)}</button></form>`;
    return html(res,
      `<h2>Fournisseur de test</h2><p>Choisis le compte à autoriser.</p>` +
      Object.entries(ACCOUNTS).map(([sub, a]) => form(`Continuer en tant que ${a.name}`, sub)).join("") +
      form("Annuler", "__cancel"));
  }
  if (url.pathname === "/approve") {
    const p = url.searchParams;
    const redirect = p.get("redirect_uri");
    const state = p.get("state") || "";
    const sub = p.get("sub");
    if (sub === "__cancel") return html(res, postBack(redirect, { error: "access_denied", state }, true));
    const account = { sub, ...ACCOUNTS[sub] };
    const code = randomBytes(16).toString("hex");
    codes.set(code, { account, nonce: p.get("nonce") || undefined, challenge: p.get("code_challenge") });
    return html(res, postBack(redirect, { code, state }, true));
  }

  if (url.pathname === "/token" && req.method === "POST") {
    const form = await readBody(req);
    const entry = codes.get(form.get("code"));
    codes.delete(form.get("code"));
    if (!entry) return json({ error: "invalid_grant" }, 400);
    if (entry.challenge) {
      const expected = createHash("sha256").update(form.get("code_verifier") || "").digest("base64url");
      if (expected !== entry.challenge) return json({ error: "invalid_grant", error_description: "PKCE" }, 400);
    }
    return json({
      access_token: randomBytes(16).toString("hex"),
      token_type: "Bearer",
      expires_in: 300,
      id_token: idToken(entry.account, entry.nonce),
    });
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, () => console.log(`OIDC de test sur ${ISSUER}`));
