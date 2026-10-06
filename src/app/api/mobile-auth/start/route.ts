import { NextRequest, NextResponse } from "next/server";
import { enabledOAuthProviderIds } from "@/lib/authProviders";
import { CHALLENGE_COOKIE, isChallenge } from "@/lib/mobileAuth";
import { startLinkFlow } from "@/lib/mobileLink";
import {
  LINK_COOKIE,
  encodeLinkIntent,
  linkCookieOptions,
  newLinkNonce,
} from "@/lib/accountLinking";

/**
 * Ouvert par l'app dans le navigateur système (voir src/lib/mobileAuth.ts) :
 * garde le défi PKCE le temps de la connexion, puis lance NextAuth.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Mode « lier au compte connecté » (src/lib/mobileLink.ts) : tout vient du
  // ticket, rien d'autre dans l'URL (ni utilisateur, ni fournisseur, ni défi).
  if (params.get("mode") === "link") {
    const flow = await startLinkFlow(params.get("ticket"));
    if (!flow || !enabledOAuthProviderIds().includes(flow.provider)) {
      return NextResponse.json(
        { error: "Lien expiré ou déjà utilisé : relance la liaison depuis l'app." },
        { status: 400 }
      );
    }
    const nonce = newLinkNonce();
    const url = new URL("/auth/mobile", req.nextUrl.origin);
    url.searchParams.set("provider", flow.provider);
    url.searchParams.set("li", nonce);
    const res = NextResponse.redirect(url);
    res.cookies.set(CHALLENGE_COOKIE.name, JSON.stringify({ mode: "link", ticketId: flow.id }), CHALLENGE_COOKIE.options);
    res.cookies.set(
      LINK_COOKIE,
      await encodeLinkIntent({ userId: flow.userId, provider: flow.provider, nonce, ticketId: flow.id }),
      linkCookieOptions
    );
    return res;
  }
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
