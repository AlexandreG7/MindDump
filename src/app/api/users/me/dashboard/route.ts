import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { normalizeLayout } from "@/lib/dashboardLayout";

/** GET — disposition de l'accueil (celle par défaut si rien n'est enregistré). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { dashboardLayout: true } });
  return NextResponse.json({ layout: normalizeLayout(row?.dashboardLayout), custom: row?.dashboardLayout != null });
}

/** PUT { layout } — enregistre la disposition ; { layout: null } revient à celle par défaut. */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body || !("layout" in body)) {
    return NextResponse.json({ error: "Disposition manquante." }, { status: 400 });
  }

  if (body.layout === null) {
    await prisma.user.update({ where: { id: user.id }, data: { dashboardLayout: Prisma.DbNull } });
    return NextResponse.json({ layout: normalizeLayout(null), custom: false });
  }
  if (!Array.isArray(body.layout)) {
    return NextResponse.json({ error: "Disposition invalide." }, { status: 400 });
  }

  const layout = normalizeLayout(body.layout);
  await prisma.user.update({ where: { id: user.id }, data: { dashboardLayout: layout as unknown as Prisma.InputJsonValue } });
  return NextResponse.json({ layout, custom: true });
}
