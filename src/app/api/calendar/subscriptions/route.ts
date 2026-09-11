import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  assertGroupMember,
  buildResourceWhere,
  resolveGroupId,
} from "@/lib/groupAuth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const groupId = new URL(req.url).searchParams.get("groupId");

  if (groupId) {
    const err = await assertGroupMember(groupId, user.id);
    if (err) return err;
  }

  // Les abonnements rattachés à un groupe sont visibles par tous ses membres.
  const where = await buildResourceWhere(user.id, groupId);

  const subs = await prisma.calendarSubscription.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { group: { select: { id: true, name: true } } },
  });

  // L'URL du calendrier (souvent un lien privé iCloud/Google) ne sort que pour
  // son propriétaire ; les autres membres n'ont besoin que du nom et de la couleur.
  return NextResponse.json(
    subs.map((sub) => ({
      id: sub.id,
      name: sub.name,
      color: sub.color,
      enabled: sub.enabled,
      groupId: sub.groupId,
      groupName: sub.group?.name ?? null,
      isOwner: sub.userId === user.id,
      url: sub.userId === user.id ? sub.url : null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const url = (body.url || "").trim().replace(/^webcal:\/\//, "https://");
  const name = (body.name || "").trim();

  if (!url || !name) {
    return NextResponse.json({ error: "URL et nom requis" }, { status: 400 });
  }

  // N'accepter que des URL http(s) (bloque javascript:, file:, data:, etc.
  // qui seraient ensuite refetchées côté client).
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "URL invalide (http/https uniquement)" }, { status: 400 });
  }

  // Un calendrier synchronisé l'est pour le groupe sélectionné : tous ses
  // membres voient les événements importés.
  const groupId = await resolveGroupId(user.id, body.groupId);
  const err = await assertGroupMember(groupId, user.id);
  if (err) return err;

  const sub = await prisma.calendarSubscription.create({
    data: {
      name,
      url,
      color: body.color || "#3b82f6",
      userId: user.id,
      groupId,
    },
  });

  return NextResponse.json(sub, { status: 201 });
}
