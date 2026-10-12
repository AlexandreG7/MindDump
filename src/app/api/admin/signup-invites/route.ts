import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { parseEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { issueInvite } from "@/lib/signupInvite";

export const dynamic = "force-dynamic";

// POST { email } : « Créer un lien pour un e-mail », sans demande préalable. Même règle
// que l'acceptation d'une demande (14 jours, usage unique, remplace les liens précédents
// de cette adresse).
export async function POST(req: NextRequest) {
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => null);
  const email = parseEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Indique une adresse e-mail valide." }, { status: 400 });

  const exists = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists) return NextResponse.json({ error: "Un compte existe déjà avec cette adresse." }, { status: 409 });

  const invite = await issueInvite({ email, createdById: admin.id });
  return NextResponse.json(
    { email, link: invite.link, expiresAt: invite.expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
