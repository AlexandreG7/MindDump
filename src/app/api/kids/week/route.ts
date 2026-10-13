import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { kidErrorResponse, readWeek, requireKidProfile, requireKidRange } from "@/lib/kidTrackers";

/** Une période (31 jours au plus) d'un enfant : rubriques actives, saisies par jour, bilan. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const q = req.nextUrl.searchParams;
    const profile = await requireKidProfile(q.get("profileId"), user.id);
    const range = requireKidRange(q.get("from"), q.get("to"));
    return NextResponse.json(await readWeek(profile.id, range));
  } catch (e) {
    const res = kidErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
