import { NextRequest, NextResponse } from "next/server";
import { submitAccessRequest } from "@/lib/betaAccess";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Essais par adresse IP et par fenêtre (limiteur en mémoire, une instance : src/lib/rateLimit.ts).
const REQUEST_MAX = 5;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;

/**
 * POST { email, name, message?, consent } : demande d'accès à la bêta (publique).
 *
 * Réponse IDENTIQUE dans tous les cas valides (nouvelle demande, doublon fusionné,
 * adresse qui a déjà un compte ou une invitation) : aucune énumération. Seules la
 * saisie invalide (400) et la limite de débit (429) se distinguent.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`beta-request:${clientIp(req.headers)}`, REQUEST_MAX, REQUEST_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(REQUEST_WINDOW_MS / 1000) } }
    );
  }
  const body = await req.json().catch(() => null);
  const result = await submitAccessRequest({
    email: body?.email,
    name: body?.name,
    message: body?.message,
    consent: body?.consent,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
