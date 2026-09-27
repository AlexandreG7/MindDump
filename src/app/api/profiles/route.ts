import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { isProfileKind, syncGroupProfiles } from "@/lib/profiles";

// GET — personnes de tous les foyers de l'utilisateur (?kind=child pour les
// enfants seulement), avec le nom du groupe pour les distinguer.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const kind = req.nextUrl.searchParams.get("kind");

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: { group: { select: { id: true, name: true } } },
  });

  const result = [];
  for (const { group } of memberships) {
    const profiles = await syncGroupProfiles(group.id);
    for (const p of profiles) {
      if (isProfileKind(kind) && p.kind !== kind) continue;
      result.push({ ...p, groupName: group.name });
    }
  }

  return NextResponse.json(result);
}
