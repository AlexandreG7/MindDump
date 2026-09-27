import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CHALLENGE_COOKIE,
  MOBILE_REDIRECT,
  createMobileAuthCode,
  isChallenge,
} from "@/lib/mobileAuth";

const SELF = "/api/mobile-auth/complete";

/**
 * Retour de la connexion dans le navigateur système : émet le code à usage
 * unique et renvoie vers l'app (minddump://auth?code=…).
 */
export async function GET(req: NextRequest) {
  let pending: { challenge?: unknown; provider?: unknown } = {};
  try {
    pending = JSON.parse(req.cookies.get(CHALLENGE_COOKIE.name)?.value ?? "{}");
  } catch {}
  if (!isChallenge(pending.challenge)) {
    return NextResponse.json(
      { error: "Connexion expirée : relance-la depuis l'app." },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", SELF);
    return NextResponse.redirect(login);
  }

  // Même règle que le middleware : pas de session dans l'app sans consentement.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { consentedAt: true } });
  if (!user?.consentedAt) {
    const consent = new URL("/consentement", req.nextUrl.origin);
    consent.searchParams.set("callbackUrl", SELF);
    return NextResponse.redirect(consent);
  }

  const provider = typeof pending.provider === "string" ? pending.provider : null;
  const code = await createMobileAuthCode(userId, pending.challenge, provider);

  const target = new URL(MOBILE_REDIRECT);
  target.searchParams.set("code", code);
  const res = NextResponse.redirect(target);
  res.cookies.set(CHALLENGE_COOKIE.name, "", { ...CHALLENGE_COOKIE.options, maxAge: 0 });
  return res;
}
