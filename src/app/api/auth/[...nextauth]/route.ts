import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  LINK_COOKIE,
  callbackMatchesIntent,
  clearLinkCookieHeader,
  decodeLinkIntent,
  linkAuthOptions,
} from "@/lib/accountLinking";

type Context = { params: { nextauth: string[] } };

const isSessionCookie = (name: string) => name.includes("next-auth.session-token");

// Sur le callback d'un fournisseur OAuth, une intention de liaison valide (posée
// depuis le profil) rattache ce fournisseur au compte existant au lieu d'en
// créer un nouveau. Voir src/lib/accountLinking.ts.
async function handler(req: NextRequest, context: Context) {
  const [action, providerId] = context.params.nextauth ?? [];
  const hasIntentCookie = !!req.cookies.get(LINK_COOKIE);

  const intent =
    action === "callback" && hasIntentCookie
      ? await decodeLinkIntent(req.cookies.get(LINK_COOKIE)?.value)
      : null;
  const intentMatches =
    !!intent && intent.provider === providerId && callbackMatchesIntent(req.cookies, intent);

  // Intention posée pour l'app mobile mais callback qui n'est pas celui de cette
  // tentative : on ne laisse jamais NextAuth créer un compte ou une session ici.
  const mobileIntent = !!intent?.ticketId;
  if (mobileIntent && !intentMatches) {
    const res = NextResponse.redirect(new URL("/api/mobile-auth/complete?link=error", req.nextUrl.origin), 303);
    res.headers.append("Set-Cookie", clearLinkCookieHeader);
    return res;
  }

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
