import { NextRequest, NextResponse } from "next/server";
import { INVITE_COOKIE, INVITE_INVALID_MESSAGE, findValidInvite } from "@/lib/signupInvite";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { GROUP_INVITE_COOKIE, GROUP_INVITE_INVALID_MESSAGE, findSignupGroupInvite } from "@/lib/groupInviteSignup";

export const dynamic = "force-dynamic";

/**
 * POST { invite } ou { groupInvite } (lien de foyer, /groups/join/…) : avant de lancer Google/Apple depuis /register?invite=…, pose le
 * jeton dans un cookie httpOnly de 15 minutes (SameSite=None en HTTPS pour survivre au
 * retour en POST cross-site d'Apple, voir INVITE_COOKIE). Le jeton n'est PAS consommé
 * ici : il l'est à la création du compte (src/lib/signupInvite.ts).
 */
export async function POST(req: NextRequest) {
  // Pose un cookie : jamais depuis un autre site, et pas via un formulaire HTML
  // (text/plain, x-www-form-urlencoded) qu'un site tiers peut soumettre sans préalable CORS.
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Requête refusée." }, { status: 415 });
  }
  if (!rateLimit(`signup-invite:${clientIp(req.headers)}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans quelques minutes." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (body?.groupInvite !== undefined) {
    const found = await findSignupGroupInvite(body.groupInvite);
    if (!found) return NextResponse.json({ error: GROUP_INVITE_INVALID_MESSAGE }, { status: 403 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(GROUP_INVITE_COOKIE.name, body.groupInvite, GROUP_INVITE_COOKIE.options);
    return res;
  }
  const invite = await findValidInvite(body?.invite);
  if (!invite) return NextResponse.json({ error: INVITE_INVALID_MESSAGE }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INVITE_COOKIE.name, body.invite, INVITE_COOKIE.options);
  return res;
}
