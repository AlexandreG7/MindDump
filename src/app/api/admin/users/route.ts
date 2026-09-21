import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminUsers, parseUsersQuery } from "@/lib/adminStats";

export const dynamic = "force-dynamic";

// GET /api/admin/users?sort=recipes&dir=desc&page=2
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const data = await getAdminUsers(parseUsersQuery(req.nextUrl.searchParams));
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
