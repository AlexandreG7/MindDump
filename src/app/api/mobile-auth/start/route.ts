import { NextRequest, NextResponse } from "next/server";
import { OAUTH_PROVIDER_NAMES, enabledOAuthProviderIds } from "@/lib/authProviders";
import { CHALLENGE_COOKIE, MOBILE_REDIRECT, isChallenge } from "@/lib/mobileAuth";
import { cancelLinkTicket, peekLinkTicket, startLinkFlow } from "@/lib/mobileLink";
import {
  CONFIRM_COOKIE,
  confirmCookieValue,
  confirmationMatches,
  confirmationPage,
  newConfirmToken,
} from "@/lib/mobileLinkConfirm";
import {
  LINK_COOKIE,
  clearLinkCookieHeader,
  encodeLinkIntent,
  linkCookieOptions,
  newLinkNonce,
} from "@/lib/accountLinking";

/**
 * Ouvert par l'app dans le navigateur système (voir src/lib/mobileAuth.ts) :
 * garde le défi PKCE le temps de la connexion, puis lance NextAuth.
 */
const plainError = (error: string, status = 400) => NextResponse.json({ error }, { status });
const EXPIRED = "Lien expiré ou déjà utilisé : relance la liaison depuis l'app.";

/** Origine attendue d'un POST : celle du site (NEXTAUTH_URL), pas celle déduite de la requête. */
const siteOrigin = (req: NextRequest) => {
  try {
    return new URL(process.env.NEXTAUTH_URL || req.nextUrl.origin).origin;
  } catch {
    return req.nextUrl.origin;
  }
};

/**
 * Ouvert par l'app dans le navigateur système (voir src/lib/mobileAuth.ts) :
 * garde le défi PKCE le temps de la connexion, puis lance NextAuth.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Mode « lier au compte connecté » (src/lib/mobileLink.ts) : le GET n'engage
  // rien (le ticket est un porteur dans l'URL, un lien piégé ne doit pas suffire).
  // Il demande confirmation ; seul le POST de la page consomme le ticket.
  if (params.get("mode") === "link") {
    const ticket = params.get("ticket");
    const info = await peekLinkTicket(ticket);
    if (!info || typeof ticket !== "string" || !enabledOAuthProviderIds().includes(info.provider)) {
      return plainError(EXPIRED);
    }
    const token = newConfirmToken();
    const res = new NextResponse(
      confirmationPage({
        providerName: OAUTH_PROVIDER_NAMES[info.provider] ?? info.provider,
        name: info.name,
        email: info.email,
        ticket,
        token,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Frame-Options": "DENY",
        },
      }
    );
    res.cookies.set(CONFIRM_COOKIE.name, confirmCookieValue(ticket, token), CONFIRM_COOKIE.options);
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
  // Une liaison abandonnée a pu laisser son intention dans ce navigateur : une
  // connexion ne doit jamais en hériter.
  res.headers.append("Set-Cookie", clearLinkCookieHeader);
  return res;
}

/**
 * Bouton « Continuer » / « Ce n'est pas mon compte » de la page de confirmation.
 * Exige le cookie SameSite=Strict (donc un formulaire de CE site), le même jeton
 * dans le formulaire, et l'Origin du site : un formulaire auto-soumis ailleurs
 * n'a aucun des trois.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== siteOrigin(req)) return plainError("Requête refusée.", 403);
  const form = await req.formData().catch(() => null);
  const ticket = form?.get("ticket");
  if (
    !form ||
    !confirmationMatches(req.cookies.get(CONFIRM_COOKIE.name)?.value, ticket, form.get("token"))
  ) {
    return plainError("Confirmation invalide : relance la liaison depuis l'app.", 403);
  }

  const done = (res: NextResponse) => {
    res.cookies.set(CONFIRM_COOKIE.name, "", { ...CONFIRM_COOKIE.options, maxAge: 0 });
    return res;
  };

  if (form.get("action") === "cancel") {
    await cancelLinkTicket(ticket);
    const back = new URL(MOBILE_REDIRECT);
    back.searchParams.set("cancelled", "1");
    return done(NextResponse.redirect(back, 303));
  }

  const flow = await startLinkFlow(ticket);
  if (!flow || !enabledOAuthProviderIds().includes(flow.provider)) return done(plainError(EXPIRED));
  const nonce = newLinkNonce();
  const url = new URL("/auth/mobile", siteOrigin(req));
  url.searchParams.set("provider", flow.provider);
  url.searchParams.set("li", nonce);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(CHALLENGE_COOKIE.name, JSON.stringify({ mode: "link", ticketId: flow.id }), CHALLENGE_COOKIE.options);
  res.cookies.set(
    LINK_COOKIE,
    await encodeLinkIntent({ userId: flow.userId, provider: flow.provider, nonce, ticketId: flow.id }),
    linkCookieOptions
  );
  return done(res);
}
