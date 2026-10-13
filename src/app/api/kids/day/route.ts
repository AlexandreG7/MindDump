import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { KidError, kidErrorResponse, requireKidDate, requireKidProfile, writeDay } from "@/lib/kidTrackers";

/**
 * Saisie d'un jour, partielle : { profileId, date, values: { [idRubrique ou libellé]:
 * choix | [choix] | nombre | null } }. Les rubriques non citées ne bougent pas.
 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const body = await req.json().catch(() => {
      throw new KidError(400, "body_invalid", "Corps JSON invalide");
    });
    const profile = await requireKidProfile(body?.profileId, user.id);
    const date = requireKidDate(body?.date);
    return NextResponse.json(await writeDay(profile.id, user.id, date, body?.values));
  } catch (e) {
    const res = kidErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
