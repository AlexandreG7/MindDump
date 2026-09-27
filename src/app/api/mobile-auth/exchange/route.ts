import { NextRequest, NextResponse } from "next/server";
import { exchangeMobileAuthCode } from "@/lib/mobileAuth";

/**
 * Appelé par l'app, dans sa WebView, avec le code reçu par minddump://auth et
 * le verifier PKCE qu'elle a gardé : pose le cookie de session NextAuth.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const cookie = await exchangeMobileAuthCode(body?.code, body?.verifier);
  if (!cookie) {
    return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
