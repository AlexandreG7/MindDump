import { NextRequest, NextResponse } from "next/server";
import { enabledOAuthProviderIds } from "@/lib/authProviders";
import { CHALLENGE_COOKIE, isChallenge } from "@/lib/mobileAuth";

/**
 * Ouvert par l'app dans le navigateur système (voir src/lib/mobileAuth.ts) :
 * garde le défi PKCE le temps de la connexion, puis lance NextAuth.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const provider = params.get("provider");
  const challenge = params.get("challenge");

  // « credentials » : identifiant et mot de passe dans le navigateur système
  // (/login), utile quand aucun fournisseur OAuth n'est configuré, en test.
  const allowed = [...enabledOAuthProviderIds(), "credentials"];
  if (!provider || !allowed.includes(provider) || !isChallenge(challenge)) {
    return NextResponse.json({ error: "Paramètres de connexion invalides" }, { status: 400 });
  }

  const url = new URL("/auth/mobile", req.nextUrl.origin);
  url.searchParams.set("provider", provider);
  const res = NextResponse.redirect(url);
  res.cookies.set(
    CHALLENGE_COOKIE.name,
    JSON.stringify({ challenge, provider }),
    CHALLENGE_COOKIE.options
  );
  return res;
}
