import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { KidError, kidErrorResponse, orderTrackers, requireKidProfile } from "@/lib/kidTrackers";

/** Ordre des rubriques d'un enfant : { profileId, ids: [idRubrique, ...] }. */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const body = await req.json().catch(() => {
      throw new KidError(400, "body_invalid", "Corps JSON invalide");
    });
    const profile = await requireKidProfile(body?.profileId, user.id);
    return NextResponse.json(await orderTrackers(profile.id, body?.ids));
  } catch (e) {
    const res = kidErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
