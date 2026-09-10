import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { generateUniquePublicId } from "@/lib/publicId";

export const dynamic = "force-dynamic";

const SELECT = {
  id: true,
  publicId: true,
  name: true,
  email: true,
  image: true,
  weatherLat: true,
  weatherLon: true,
  weatherCity: true,
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let full = await prisma.user.findUnique({
    where: { id: user.id },
    select: SELECT,
  });

  if (full && !full.publicId) {
    const publicId = await generateUniquePublicId();
    full = await prisma.user.update({
      where: { id: user.id },
      data: { publicId },
      select: SELECT,
    });
  }

  return NextResponse.json(full);
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();

  if (!("weatherLat" in body) || !("weatherLon" in body)) {
    return NextResponse.json({ error: "weatherLat et weatherLon requis" }, { status: 400 });
  }

  const lat = body.weatherLat === null ? null : Number(body.weatherLat);
  const lon = body.weatherLon === null ? null : Number(body.weatherLon);

  if ((lat !== null && Number.isNaN(lat)) || (lon !== null && Number.isNaN(lon))) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }

  const full = await prisma.user.update({
    where: { id: user.id },
    data: {
      weatherLat: lat,
      weatherLon: lon,
      weatherCity: lat === null ? null : (body.weatherCity ?? null),
    },
    select: SELECT,
  });

  return NextResponse.json(full);
}
