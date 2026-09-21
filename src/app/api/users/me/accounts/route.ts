import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import {
  OAUTH_PROVIDER_NAMES,
  enabledOAuthProviderIds,
  revokeAppleToken,
} from "@/lib/authProviders";
import {
  LINK_COOKIE,
  encodeLinkIntent,
  linkCookieOptions,
  newLinkNonce,
} from "@/lib/accountLinking";

export const dynamic = "force-dynamic";

// Toutes les actions de cette route exigent une session : une clé API ne peut
// ni voir, ni lier, ni délier les moyens de connexion.
async function sessionUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

// GET — moyens de connexion du compte : mot de passe et fournisseurs liés.
export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, accounts: { select: { provider: true } } },
  });
  if (!user) return unauthorized();

  const linked = new Set(user.accounts.map((a) => a.provider));
  return NextResponse.json({
    hasPassword: !!user.password,
    providers: enabledOAuthProviderIds().map((id) => ({
      id,
      name: OAUTH_PROVIDER_NAMES[id] ?? id,
      linked: linked.has(id),
    })),
  });
}

// POST { provider } — prépare la liaison : pose le cookie d'intention et renvoie
// son nonce, que le client met dans l'URL de retour de signIn(provider).
// Voir src/lib/accountLinking.ts.
export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const { provider } = await req.json().catch(() => ({}));
  if (typeof provider !== "string" || !enabledOAuthProviderIds().includes(provider)) {
    return NextResponse.json({ error: "Fournisseur inconnu." }, { status: 400 });
  }

  const already = await prisma.account.findFirst({ where: { userId, provider }, select: { id: true } });
  if (already) {
    return NextResponse.json({ error: "Ce fournisseur est déjà lié." }, { status: 409 });
  }

  const nonce = newLinkNonce();
  const response = NextResponse.json({ nonce });
  response.cookies.set(LINK_COOKIE, await encodeLinkIntent({ userId, provider, nonce }), linkCookieOptions);
  return response;
}

// DELETE ?provider=google — délie un fournisseur, s'il reste un autre moyen de
// se connecter (mot de passe ou autre fournisseur).
export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const provider = req.nextUrl.searchParams.get("provider");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      accounts: { select: { id: true, provider: true, refresh_token: true } },
    },
  });
  if (!user) return unauthorized();

  const target = user.accounts.filter((a) => a.provider === provider);
  if (target.length === 0) {
    return NextResponse.json({ error: "Ce fournisseur n'est pas lié." }, { status: 404 });
  }

  const remaining = user.accounts.length - target.length + (user.password ? 1 : 0);
  if (remaining < 1) {
    return NextResponse.json(
      { error: "C'est ton seul moyen de connexion : lie un autre compte avant de le retirer." },
      { status: 409 }
    );
  }

  await prisma.account.deleteMany({ where: { id: { in: target.map((a) => a.id) } } });
  if (provider === "apple") {
    for (const account of target) await revokeAppleToken(account.refresh_token);
  }
  return NextResponse.json({ ok: true });
}
