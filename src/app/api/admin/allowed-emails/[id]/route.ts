import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { removeAllowedEmail } from "@/lib/signupAllowlist";

export const dynamic = "force-dynamic";

// DELETE /api/admin/allowed-emails/:id : retire l'adresse de la liste. Ne touche JAMAIS à un
// compte existant (ADR 0001) : seule la création d'un nouveau compte sans lien disparaît.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const result = await removeAllowedEmail(params.id);
  if (result === "not-found") return NextResponse.json({ error: "Adresse introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
