import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { refuseBetaRequest } from "@/lib/betaAccess";

export const dynamic = "force-dynamic";

// POST /api/admin/beta-requests/:id/refuse : refuse et invalide les liens en cours.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const result = await refuseBetaRequest(params.id);
  if (result === "not-found") return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (result === "registered") {
    return NextResponse.json({ error: "Cette personne est déjà inscrite." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
