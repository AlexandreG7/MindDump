import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { KidError, deleteTracker, kidErrorResponse, requireKidTracker, updateTracker } from "@/lib/kidTrackers";

// Une rubrique inaccessible (autre foyer) est introuvable : 404, jamais 403.

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    await requireKidTracker(params.id, user.id);
    const body = await req.json().catch(() => {
      throw new KidError(400, "body_invalid", "Corps JSON invalide");
    });
    return NextResponse.json(await updateTracker(params.id, body));
  } catch (e) {
    const res = kidErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

/** Supprime une rubrique sans saisie ; avec des saisies : 409, la masquer (PATCH active:false). */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    await requireKidTracker(params.id, user.id);
    await deleteTracker(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const res = kidErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
