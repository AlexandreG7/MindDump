import { NextRequest, NextResponse } from "next/server";
import { INVITE_COOKIE, INVITE_INVALID_MESSAGE, findValidInvite } from "@/lib/signupInvite";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST { invite } : avant de lancer Google/Apple depuis /register?invite=…, pose le
 * jeton dans un cookie httpOnly de 15 minutes (SameSite=None en HTTPS pour survivre au
 * retour en POST cross-site d'Apple, voir INVITE_COOKIE). Le jeton n'est PAS consommé
 * ici : il l'est à la création du compte (src/lib/signupInvite.ts).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`signup-invite:${clientIp(req.headers)}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans quelques minutes." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const invite = await findValidInvite(body?.invite);
  if (!invite) return NextResponse.json({ error: INVITE_INVALID_MESSAGE }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INVITE_COOKIE.name, body.invite, INVITE_COOKIE.options);
  return res;
}
