import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listBetaRequests } from "@/lib/betaAccess";

export const dynamic = "force-dynamic";

// GET /api/admin/beta-requests : demandes d'accès à la bêta.
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json(
    { requests: await listBetaRequests() },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
