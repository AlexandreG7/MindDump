import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unauthorized } from "@/lib/session";
import { exportUserData } from "@/lib/account";

export const dynamic = "force-dynamic";

// GET — export RGPD de toutes les données du compte (JSON téléchargeable).
// Session uniquement : une clé API ne permet pas d'extraire tout le compte.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const data = await exportUserData(session.user.id);
  if (!data) return unauthorized();

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="minddump-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
