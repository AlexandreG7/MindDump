import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  LINK_COOKIE,
  callbackMatchesIntent,
  clearLinkCookieHeader,
  decodeLinkIntent,
  linkAuthOptions,
} from "@/lib/accountLinking";

type Context = { params: { nextauth: string[] } };

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
  const useIntent =
    !!intent && intent.provider === providerId && callbackMatchesIntent(req.cookies, intent);

  const response: Response = await NextAuth(
    req,
    context,
    useIntent && intent ? linkAuthOptions(authOptions, intent) : authOptions
  );

  // Usage unique : l'intention est consommée au premier callback, qu'elle ait
  // servi ou non, et ne survit pas à une déconnexion.
  if (hasIntentCookie && (action === "callback" || action === "signout")) {
    response.headers.append("Set-Cookie", clearLinkCookieHeader);
  }
  return response;
}

export { handler as GET, handler as POST };
