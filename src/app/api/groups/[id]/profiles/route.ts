import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember } from "@/lib/groupAuth";
import {
  isBirthDate,
  isProfileColor,
  isProfileKind,
  nextProfileColor,
  profileSelect,
  syncGroupProfiles,
} from "@/lib/profiles";

// GET — personnes du foyer : un profil par membre, plus les profils sans compte
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const err = await assertGroupMember(params.id, user.id);
  if (err) return err;

  return NextResponse.json(await syncGroupProfiles(params.id));
}

// POST — ajouter une personne sans compte (un enfant, le plus souvent)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const err = await assertGroupMember(params.id, user.id);
  if (err) return err;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Prénom requis" }, { status: 400 });

  const existing = await prisma.familyProfile.findMany({
    where: { groupId: params.id },
    select: { color: true, position: true },
  });

  const profile = await prisma.familyProfile.create({
    data: {
      groupId: params.id,
      name,
      kind: isProfileKind(body.kind) ? body.kind : "child",
      color: isProfileColor(body.color)
        ? body.color
        : nextProfileColor(existing.map((p) => p.color)),
      emoji: typeof body.emoji === "string" && body.emoji.trim() ? body.emoji.trim().slice(0, 8) : null,
      birthDate: isBirthDate(body.birthDate) ? body.birthDate : null,
      position: existing.reduce((max, p) => Math.max(max, p.position), -1) + 1,
    },
    select: profileSelect,
  });

  return NextResponse.json(profile, { status: 201 });
}
