import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { NOTE_MAX, addAllowedEmail, listAllowedEmails } from "@/lib/signupAllowlist";

export const dynamic = "force-dynamic";

// GET : adresses qui peuvent créer leur compte directement sur /register?direct=1, sans lien.
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ emails: await listAllowedEmails() }, { headers: { "Cache-Control": "private, no-store" } });
}

// POST { email, note? } : ajoute une adresse (normalisée, ASCII strict). 400 si invalide,
// 409 si elle est déjà dans la liste.
export async function POST(req: NextRequest) {
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => null);
  const result = await addAllowedEmail(body?.email, body?.note, admin.id);
  if (!result.ok) {
    if (result.reason === "duplicate") {
      return NextResponse.json({ error: "Cette adresse est déjà dans la liste." }, { status: 409 });
    }
    if (result.reason === "note-too-long") {
      return NextResponse.json({ error: `La note est trop longue (${NOTE_MAX} caractères maximum).` }, { status: 400 });
    }
    return NextResponse.json({ error: "Indique une adresse e-mail valide." }, { status: 400 });
  }
  return NextResponse.json(result.entry, { status: 201, headers: { "Cache-Control": "no-store" } });
}
