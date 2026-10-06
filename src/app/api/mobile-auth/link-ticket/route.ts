import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enabledOAuthProviderIds } from "@/lib/authProviders";
import { NATIVE_APP_COOKIE, isNativeRequest } from "@/lib/native";
import { createLinkTicket } from "@/lib/mobileLink";
import { isChallenge } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

/**
 * Appelé par l'app, dans sa WebView connectée : ticket de liaison pour
 * l'utilisateur de la session (src/lib/mobileLink.ts). Session obligatoire (pas
 * de clé API) et réservé à l'app.
 */
export async function POST(req: NextRequest) {
  if (!isNativeRequest(req.headers.get("user-agent"), cookies().get(NATIVE_APP_COOKIE)?.value)) {
    return NextResponse.json({ error: "Réservé à l'app" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { provider, challenge } = await req.json().catch(() => ({}));
  if (
    typeof provider !== "string" ||
    !enabledOAuthProviderIds().includes(provider) ||
    !isChallenge(challenge)
  ) {
    return NextResponse.json({ error: "Fournisseur inconnu." }, { status: 400 });
  }
  const already = await prisma.account.findFirst({ where: { userId, provider }, select: { id: true } });
  if (already) return NextResponse.json({ error: "Ce fournisseur est déjà lié." }, { status: 409 });

  const ticket = await createLinkTicket(userId, provider, challenge);
  if (!ticket) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  return NextResponse.json({ ticket });
}
