import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listBetaRequests } from "@/lib/betaAccess";

export const dynamic = "force-dynamic";

// GET /api/admin/beta-requests?offset=0&limit=50 : demandes d'accès à la bêta, « en attente »
// d'abord puis par date décroissante, avec le total et le nombre en attente.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const params = req.nextUrl.searchParams;
  const page = await listBetaRequests({
    offset: Number(params.get("offset")) || 0,
    limit: Number(params.get("limit")) || undefined,
  });
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
