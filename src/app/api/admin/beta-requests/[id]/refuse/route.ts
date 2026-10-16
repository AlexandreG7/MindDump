import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { refuseBetaRequest } from "@/lib/betaAccess";

export const dynamic = "force-dynamic";

// POST /api/admin/beta-requests/:id/refuse : refuse et invalide les liens en cours.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const result = await refuseBetaRequest(params.id);
  if (result === "not-found") return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (result === "registered") {
    return NextResponse.json({ error: "Cette personne est déjà inscrite." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
