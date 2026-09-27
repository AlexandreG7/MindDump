import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  findAccessibleProfile,
  isBirthDate,
  isGroupAdmin,
  isProfileColor,
  isProfileKind,
  profileSelect,
} from "@/lib/profiles";

const notFound = () => NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

// PATCH — modifier une personne du foyer. Tout membre gère les profils sans
// compte ; le profil d'un membre se modifie par lui-même ou par un admin.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const profile = await findAccessibleProfile(params.id, user.id);
  if (!profile) return notFound();

  if (profile.userId && profile.userId !== user.id && !(await isGroupAdmin(profile.groupId, user.id))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 60);
  if (isProfileColor(body.color)) data.color = body.color;
  if (body.emoji === null || (typeof body.emoji === "string" && !body.emoji.trim())) data.emoji = null;
  else if (typeof body.emoji === "string") data.emoji = body.emoji.trim().slice(0, 8);
  if (body.birthDate === null || isBirthDate(body.birthDate)) data.birthDate = body.birthDate;
  if (Number.isInteger(body.position)) data.position = body.position;
  // Un membre avec compte reste un adulte.
  if (!profile.userId && isProfileKind(body.kind)) data.kind = body.kind;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const updated = await prisma.familyProfile.update({
    where: { id: params.id },
    data,
    select: profileSelect,
  });
  return NextResponse.json(updated);
}

// DELETE — retirer une personne sans compte, avec son semainier. Le profil
// d'un membre disparaît seulement quand il quitte le groupe.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const profile = await findAccessibleProfile(params.id, user.id);
  if (!profile) return notFound();

  if (profile.userId) {
    return NextResponse.json(
      { error: "Ce profil est celui d'un membre : retirez-le du groupe" },
      { status: 400 }
    );
  }

  await prisma.familyProfile.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
