import { createPrivateKey, sign } from "crypto";
import type { Provider } from "next-auth/providers/index";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";

/**
 * Fournisseurs OAuth. Chacun n'est actif que si ses variables d'environnement
 * sont définies (voir docs/oauth.md).
 */

export const OAUTH_PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  "test-oidc": "Fournisseur de test",
};

// ─── Apple : client secret ─────────────────────────────────────
// Apple n'accepte pas de secret fixe : c'est un JWT ES256 signé avec la clé .p8,
// valable 6 mois maximum. On le génère à la demande et on le renouvelle tous les
// 30 jours, pour qu'un serveur qui tourne longtemps n'ait jamais un secret expiré.

const APPLE_SECRET_TTL_S = 180 * 24 * 3600;
const APPLE_SECRET_RENEW_MS = 30 * 24 * 3600 * 1000;
let appleSecretCache: { value: string; createdAt: number } | null = null;

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function appleClientSecret(): string {
  if (appleSecretCache && Date.now() - appleSecretCache.createdAt < APPLE_SECRET_RENEW_MS) {
    return appleSecretCache.value;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: process.env.APPLE_KEY_ID };
  const payload = {
    iss: process.env.APPLE_TEAM_ID,
    iat: now,
    exp: now + APPLE_SECRET_TTL_S,
    aud: "https://appleid.apple.com",
    sub: process.env.APPLE_ID,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // La clé .p8 est souvent stockée sur une ligne avec des "\n" littéraux.
  const key = createPrivateKey((process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"));
  const signature = sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  const value = `${signingInput}.${base64url(signature)}`;
  appleSecretCache = { value, createdAt: Date.now() };
  return value;
}

const appleEnabled = !!(
  process.env.APPLE_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_PRIVATE_KEY
);

// ─── Fournisseur de test (développement uniquement) ────────────
// Serveur OIDC local qui imite Apple (retour en POST form_post), pour tester
// connexion, liaison et déliaison sans compte Google/Apple. Jamais actif en
// production, même si la variable est définie par erreur.
const testIssuer =
  process.env.NODE_ENV !== "production" ? process.env.OAUTH_TEST_ISSUER : undefined;

export function oauthProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  if (appleEnabled) {
    const options = { clientId: process.env.APPLE_ID as string, clientSecret: "" };
    // Getter : NextAuth relit les options à chaque requête, le secret reste frais.
    Object.defineProperty(options, "clientSecret", { get: appleClientSecret, enumerable: true });
    providers.push(AppleProvider(options));
  }

  if (testIssuer) {
    providers.push({
      id: "test-oidc",
      name: OAUTH_PROVIDER_NAMES["test-oidc"],
      type: "oauth",
      wellKnown: `${testIssuer}/.well-known/openid-configuration`,
      authorization: { params: { scope: "openid email profile", response_mode: "form_post" } },
      idToken: true,
      checks: ["pkce"],
      clientId: "minddump-test",
      clientSecret: "minddump-test-secret",
      profile(profile: { sub: string; name?: string; email?: string }) {
        return { id: profile.sub, name: profile.name, email: profile.email, image: null };
      },
    });
  }

  return providers;
}

/** Identifiants des fournisseurs OAuth actifs, dans l'ordre d'affichage. */
export function enabledOAuthProviderIds(): string[] {
  return oauthProviders().map((p) => p.id);
}

/**
 * Révoque les jetons Apple d'un compte (déliaison, suppression de compte), comme
 * Apple le demande. Au mieux : un échec ne bloque pas l'opération locale.
 */
export async function revokeAppleToken(token: string | null | undefined): Promise<void> {
  if (!appleEnabled || !token) return;
  try {
    await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.APPLE_ID as string,
        client_secret: appleClientSecret(),
        token,
        token_type_hint: "refresh_token",
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Révocation Apple impossible", error);
  }
}

/**
 * Cookies NextAuth. Apple renvoie vers le callback par un POST cross-site
 * (form_post) : les cookies SameSite=Lax n'y sont pas envoyés. Le vérificateur
 * PKCE, le state et l'URL de retour passent donc en SameSite=None (ce qui impose
 * HTTPS). Le cookie de session et le jeton CSRF restent en Lax.
 */
export function oauthCookies(useSecureCookies: boolean) {
  if (!useSecureCookies) return undefined; // en HTTP (dev), les valeurs par défaut suffisent
  const crossSite = (name: string, maxAge?: number) => ({
    name: `__Secure-next-auth.${name}`,
    options: {
      httpOnly: true,
      sameSite: "none" as const,
      path: "/",
      secure: true,
      ...(maxAge ? { maxAge } : {}),
    },
  });
  return {
    pkceCodeVerifier: crossSite("pkce.code_verifier", 60 * 15),
    state: crossSite("state", 60 * 15),
    nonce: crossSite("nonce"),
    callbackUrl: crossSite("callback-url"),
  };
}
