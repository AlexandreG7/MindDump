import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { issueInvite } from "@/lib/signupInvite";

export const dynamic = "force-dynamic";

// POST /api/admin/beta-requests/:id/invite : « Accepter » ET « Régénérer le lien ».
// Crée un lien d'inscription à usage unique (14 jours) lié à l'e-mail de la demande,
// invalide les précédents, et renvoie le lien EN CLAIR, une seule fois.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const request = await prisma.betaAccessRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (request.status === "registered") {
    return NextResponse.json({ error: "Cette personne est déjà inscrite." }, { status: 409 });
  }
  const exists = await prisma.user.findFirst({
    where: { email: { equals: request.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists) return NextResponse.json({ error: "Un compte existe déjà avec cette adresse." }, { status: 409 });

  const invite = await issueInvite({ email: request.email, createdById: admin.id, requestId: request.id });
  return NextResponse.json(
    { link: invite.link, expiresAt: invite.expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
