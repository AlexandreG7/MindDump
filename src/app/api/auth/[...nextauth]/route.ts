import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { CHALLENGE_COOKIE } from "@/lib/mobileAuth";
import { authOptions } from "@/lib/auth";
import {
  LINK_COOKIE,
  callbackMatchesIntent,
  callbackNonce,
  clearLinkCookieHeader,
  decodeLinkIntent,
  linkAuthOptions,
} from "@/lib/accountLinking";

const clearChallengeCookieHeader = `${CHALLENGE_COOKIE.name}=; Path=${CHALLENGE_COOKIE.options.path}; Max-Age=0; HttpOnly${
  CHALLENGE_COOKIE.options.secure ? "; Secure; SameSite=None" : "; SameSite=Lax"
}`;

type Context = { params: { nextauth: string[] } };

const isSessionCookie = (name: string) => name.includes("next-auth.session-token");

// Sur le callback d'un fournisseur OAuth, une intention de liaison valide (posée
// depuis le profil) rattache ce fournisseur au compte existant au lieu d'en
// créer un nouveau. Voir src/lib/accountLinking.ts.
async function handler(req: NextRequest, context: Context) {
  const [action, providerId] = context.params.nextauth ?? [];

  // Refus chez le fournisseur (access_denied…) pendant une liaison depuis l'app :
  // NextAuth redirige vers /api/auth/signin?error=… ou /api/auth/error?error=…
  // (une NOUVELLE requête, sans l'intention, déjà consommée) puis vers /login.
  // Le navigateur système doit revenir à l'app avec un échec (« La liaison a
  // échoué. »), pas rester sur la page de connexion.
  if (
    req.method === "GET" &&
    (action === "signin" || action === "error") &&
    !providerId &&
    req.nextUrl.searchParams.has("error")
  ) {
    let pending: { mode?: unknown; nonce?: unknown } = {};
    try {
      pending = JSON.parse(req.cookies.get(CHALLENGE_COOKIE.name)?.value ?? "{}");
    } catch {}
    if (pending.mode === "link") {
      // Seule la tentative de liaison EN COURS revient à l'app : son nonce est dans
      // l'URL de retour mémorisée par NextAuth. Un cookie de parcours resté d'une
      // liaison abandonnée (SameSite=None, 15 min) ne doit pas détourner une erreur
      // de connexion web faite ensuite dans ce navigateur : on l'efface, et la
      // connexion suit son cours (retour vers /login).
      if (typeof pending.nonce === "string" && callbackNonce(req.cookies) === pending.nonce) {
        return NextResponse.redirect(new URL("/api/mobile-auth/complete?link=error", req.nextUrl.origin), 303);
      }
      const res = (await NextAuth(req, context, authOptions)) as Response;
      const headers = new Headers(res.headers);
      headers.append("Set-Cookie", clearChallengeCookieHeader);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }
  }

  const hasIntentCookie = !!req.cookies.get(LINK_COOKIE);

  const intent =
    action === "callback" && hasIntentCookie
      ? await decodeLinkIntent(req.cookies.get(LINK_COOKIE)?.value)
      : null;
  const intentMatches =
    !!intent && intent.provider === providerId && callbackMatchesIntent(req.cookies, intent);

  // Intention de liaison qui n'est pas celle de cette tentative (liaison abandonnée
  // dans ce navigateur, par exemple) : on l'ignore, la connexion se déroule
  // normalement, et le cookie est effacé en fin de callback (plus bas).
  const mobileIntent = !!intent?.ticketId;

  let response: Response = await NextAuth(
    req,
    context,
    intentMatches && intent ? linkAuthOptions(authOptions, intent) : authOptions
  );

  if (mobileIntent && intentMatches) {
    // Lier n'ouvre pas de session : on retire celle que NextAuth vient de poser.
    const headers = new Headers(response.headers);
    const cookies = headers.getSetCookie().filter((c) => !isSessionCookie(c.split("=")[0]));
    headers.delete("set-cookie");
    cookies.forEach((c) => headers.append("set-cookie", c));
    response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  // Usage unique : l'intention est consommée au premier callback, qu'elle ait
  // servi ou non, et ne survit pas à une déconnexion.
  if (hasIntentCookie && (action === "callback" || action === "signout")) {
    response.headers.append("Set-Cookie", clearLinkCookieHeader);
  }
  return response;
}

export { handler as GET, handler as POST };
