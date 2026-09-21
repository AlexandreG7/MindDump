import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { CONSENT_VERSION } from "@/lib/consent";

export const dynamic = "force-dynamic";

// POST — enregistrer le consentement (comptes Google et comptes antérieurs à la
// politique). Session uniquement : une clé API ne peut pas consentir à la place
// de la personne.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await req.json().catch(() => ({}));
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "Le consentement doit être donné explicitement." },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { consentedAt: new Date(), consentVersion: CONSENT_VERSION },
    select: { consentedAt: true, consentVersion: true },
  });

  return NextResponse.json(user);
}
