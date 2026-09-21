import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminOverview, getAdminStorage } from "@/lib/adminStats";

// Dynamique : l'autorisation est vérifiée à chaque appel. Seuls les agrégats
// sont mis en cache (60 s, voir lib/adminStats.ts).
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const [overview, storage] = await Promise.all([getAdminOverview(), getAdminStorage()]);
  return NextResponse.json(
    { overview, storage },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
