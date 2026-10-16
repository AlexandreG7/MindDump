import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { deleteBetaRequest } from "@/lib/betaAccess";

export const dynamic = "force-dynamic";

// DELETE /api/admin/beta-requests/:id : efface la demande, quel que soit son statut, et ses
// invitations (RGPD). Ne touche jamais à un compte existant.
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const result = await deleteBetaRequest(params.id);
  if (result === "not-found") return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
