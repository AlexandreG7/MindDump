import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function middleware(req: NextRequest) {
  // Skip auth entirely in dev mode
  if (process.env.SKIP_AUTH === "true") {
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
    "/",
    "/todos/:path*",
    "/calendar/:path*",
    "/lists/:path*",
    "/recipes/:path*",
    "/profile",
    "/groups",
    "/groups/((?!join).*)",
  ],
};
