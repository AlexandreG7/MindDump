import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// All toggleable features with their default state (true = enabled)
const ALL_FEATURES = ["todos", "calendar", "lists", "recipes"] as const;
type Feature = (typeof ALL_FEATURES)[number];

/** GET /api/features — returns { todos: true, calendar: true, ... } */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const rows = await prisma.userFeatureFlag.findMany({
    where: { userId: user.id },
  });

  // Build map with defaults (all true), overridden by DB rows
  const flags: Record<Feature, boolean> = Object.fromEntries(
    ALL_FEATURES.map((f) => [f, true])
  ) as Record<Feature, boolean>;

  for (const row of rows) {
    if (ALL_FEATURES.includes(row.feature as Feature)) {
      flags[row.feature as Feature] = row.enabled;
    }
  }

  return NextResponse.json(flags);
}

/** PATCH /api/features — body: { feature: string, enabled: boolean } */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { feature, enabled } = await req.json();

  if (!ALL_FEATURES.includes(feature)) {
    return NextResponse.json({ error: "Feature inconnue." }, { status: 400 });
  }

  await prisma.userFeatureFlag.upsert({
    where: { userId_feature: { userId: user.id, feature } },
    update: { enabled },
    create: { userId: user.id, feature, enabled },
  });

  return NextResponse.json({ ok: true });
}
