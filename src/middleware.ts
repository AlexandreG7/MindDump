import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthBypassEnabled } from "./lib/devAuth";

const authMiddleware = withAuth(
  function requireConsent(req: NextRequestWithAuth) {
    // Consentement RGPD : un compte créé via Google (sans passer par /register) ou
    // antérieur à la politique n'a pas encore consenti. On le bloque sur
    // /consentement tant que User.consentedAt est vide (porté par le jeton).
    const token = req.nextauth.token;
    const { pathname, search } = req.nextUrl;
    if (token && !token.consented && pathname !== "/consentement") {
      const url = new URL("/consentement", req.url);
      url.searchParams.set("callbackUrl", pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      // "/" reste public : landing page pour les visiteurs, dashboard sinon.
      authorized: ({ req, token }) => req.nextUrl.pathname === "/" || !!token,
    },
  }
);

function middleware(req: NextRequest) {
  // Skip auth entirely in dev mode (jamais actif en production, voir devAuth.ts)
  if (isAuthBypassEnabled) {
    return NextResponse.next();
  }

  return (authMiddleware as unknown as (req: NextRequest) => Promise<NextResponse>)(req);
}

export default middleware;

export const config = {
  matcher: [
    "/",
    "/todos/:path*",
    "/calendar/:path*",
    "/lists/:path*",
    "/recipes/:path*",
    "/kids/:path*",
    "/profile",
    "/groups",
    "/groups/((?!join).*)",
    "/consentement",
    // L'authentification seule ne suffit pas : la page vérifie aussi le rôle
    // en base (src/lib/admin.ts) et renvoie une 404 aux non-administrateurs.
    "/admin/:path*",
  ],
};
