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
import { completeLinkFlow } from "@/lib/mobileLink";

const SELF = "/api/mobile-auth/complete";

/**
 * Retour de la connexion dans le navigateur système : émet le code à usage
 * unique et renvoie vers l'app (minddump://auth?code=…).
 */
export async function GET(req: NextRequest) {
  // Les pages /login et /consentement reviennent ici par router.push : Next
  // tente d'abord une requête RSC (fetch), qui ne doit rien consommer. Une
  // réponse qui n'est pas du RSC le fait basculer en navigation complète, la
  // seule qui émet le code.
  if (req.headers.get("RSC") === "1") return new NextResponse(null, { status: 200 });

  let pending: { challenge?: unknown; provider?: unknown; mode?: unknown; ticketId?: unknown } = {};
  try {
    pending = JSON.parse(req.cookies.get(CHALLENGE_COOKIE.name)?.value ?? "{}");
  } catch {}

  // Liaison : ni session, ni consentement, ni nouvel utilisateur. Le résultat est
  // déposé sur le ticket (src/lib/mobileLink.ts) ; le code ne vaut que pour lui.
  const linkParam = req.nextUrl.searchParams.get("link");
  // Jamais de JSON brut dans le navigateur : une liaison sans parcours en cours
  // (cookie perdu ou expiré) renvoie vers /login avec un message.
  const linkExpired = () => {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("error", "LinkExpired");
    return NextResponse.redirect(login);
  };
  if (pending.mode !== "link" && linkParam !== null) return linkExpired();

  if (pending.mode === "link") {
    // Un `error` (page d'erreur NextAuth) ne vaut jamais succès.
    const status = req.nextUrl.searchParams.has("error") ? "error" : linkParam;
    const code = await completeLinkFlow(pending.ticketId, status);
    if (!code) return linkExpired();
    const target = new URL(MOBILE_REDIRECT);
    target.searchParams.set("code", code);
    target.searchParams.set("mode", "link");
    const res = NextResponse.redirect(target);
    res.cookies.set(CHALLENGE_COOKIE.name, "", { ...CHALLENGE_COOKIE.options, maxAge: 0 });
    return res;
  }

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
