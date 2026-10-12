import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { deleteDirectInvites } from "@/lib/betaAccess";

export const dynamic = "force-dynamic";

// DELETE /api/admin/signup-invites/:id : efface les liens directs (sans demande) de l'adresse
// de cette invitation. Ne touche jamais à un compte existant.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const result = await deleteDirectInvites(params.id);
  if (result === "not-found") return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
