import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeLinkCode } from "@/lib/mobileLink";

export const dynamic = "force-dynamic";

/**
 * Appelé par l'app, dans sa WebView connectée, avec le code reçu par
 * minddump://auth?mode=link et le verifier PKCE : renvoie le résultat de la
 * liaison (linked / taken / error). Ne pose aucun cookie. La session doit être
 * celle de l'utilisateur pour qui le ticket a été émis.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const outcome = await exchangeLinkCode(body?.code, body?.verifier, userId);
  if (!outcome) return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 400 });
  return NextResponse.json(outcome);
}
