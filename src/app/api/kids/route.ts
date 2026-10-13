import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { findAccessibleProfile } from "@/lib/profiles";

// Le semainier appartient à l'enfant (profil du foyer) : tous les membres du
// groupe le voient et le remplissent. Lecture des anciennes colonnes seulement,
// conservée jusqu'au contract pour les onglets restés sur l'ancienne version ;
// les routes courantes sont dans ./trackers, ./week et ./day.

/** Colonne texte écrite par l'ancienne version : une valeur illisible ne doit pas faire échouer la lecture. */
function parseActivities(raw: string | null): unknown[] {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!from || !to || !profileId) {
    return NextResponse.json({ error: "from, to and profileId required" }, { status: 400 });
  }
  if (!(await findAccessibleProfile(profileId, user.id))) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const entries = await prisma.kidDayEntry.findMany({
    where: {
      profileId,
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
  });

  const parsed = entries.map((e) => ({
    ...e,
    activities: parseActivities(e.activities),
  }));

  return NextResponse.json(parsed);
}

/**
 * Ancienne saisie par colonnes fixes : refusée. Les saisies passent par
 * PATCH /api/kids/day (rubriques choisies par la famille). Un onglet resté sur
 * l'ancienne version reçoit ce message plutôt que d'écrire dans des colonnes que
 * plus rien ne lit. Supprimée avec les colonnes au contract.
 */
export async function PATCH() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json(
    { error: "Nouvelle version, recharge la page", code: "outdated_client" },
    { status: 409 }
  );
}
