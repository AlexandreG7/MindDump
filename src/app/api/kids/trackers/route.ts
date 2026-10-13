import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  KidError,
  createTracker,
  kidErrorResponse,
  listTrackers,
  requireKidProfile,
  validateTrackerInput,
} from "@/lib/kidTrackers";

// Rubriques du semainier d'un enfant. Accès : membre du groupe de l'enfant
// (session ou clé API), 404 sinon.

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const profile = await requireKidProfile(req.nextUrl.searchParams.get("profileId"), user.id);
    const all = req.nextUrl.searchParams.get("all") === "1";
    return NextResponse.json(await listTrackers(profile.id, all));
  } catch (e) {
    const res = kidErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const body = await req.json().catch(() => {
      throw new KidError(400, "body_invalid", "Corps JSON invalide");
    });
    const profile = await requireKidProfile(body?.profileId, user.id);
    const input = validateTrackerInput(body);
    return NextResponse.json(await createTracker(profile.id, user.id, input), { status: 201 });
  } catch (e) {
    const res = kidErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
