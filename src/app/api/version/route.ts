import { NextResponse } from "next/server";
import { BUILD_ID } from "@/lib/buildId";

export const dynamic = "force-dynamic";

// Public et sans donnée : sert au client à repérer un nouveau déploiement
// (src/components/AppHealth.tsx).
export function GET() {
  return NextResponse.json({ build: BUILD_ID }, { headers: { "Cache-Control": "no-store" } });
}
