import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthBypassEnabled } from "./lib/devAuth";

function middleware(req: NextRequest) {
  // Skip auth entirely in dev mode (jamais actif en production, voir devAuth.ts)
  if (isAuthBypassEnabled) {
    return NextResponse.next();
  }

  // Otherwise use NextAuth middleware
  return (withAuth({
    pages: { signIn: "/login" },
  }) as unknown as (req: NextRequest) => Promise<NextResponse>)(req);
}

export default middleware;

export const config = {
  matcher: [
    // "/" stays public: it serves the landing page to visitors and the
    // dashboard to authenticated users.
    "/todos/:path*",
    "/calendar/:path*",
    "/lists/:path*",
    "/recipes/:path*",
    "/profile",
    "/groups",
    "/groups/((?!join).*)",
  ],
};
