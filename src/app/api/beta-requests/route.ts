import { NextRequest, NextResponse } from "next/server";
import { submitAccessRequest } from "@/lib/betaAccess";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { assertSameOrigin } from "@/lib/sameOrigin";

export const dynamic = "force-dynamic";

// Essais par adresse IP et par fenêtre (limiteur en mémoire, une instance : src/lib/rateLimit.ts).
const REQUEST_MAX = 5;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;
// Plafond TOUTES IP confondues : un attaquant qui change d'adresse (ou un /64 IPv6 entier)
// ne peut pas noyer la file d'attente de l'administrateur.
const GLOBAL_MAX = 60;
// Un formulaire légitime tient en moins de 1 Ko (prénom 80 + message 500 + adresse 254).
const BODY_MAX_BYTES = 8 * 1024;

const tooMany = () =>
  NextResponse.json(
    { error: "Trop de demandes. Réessaie plus tard." },
    { status: 429, headers: { "Retry-After": String(REQUEST_WINDOW_MS / 1000) } }
  );

/**
 * POST { email, name, message?, consent } : demande d'accès à la bêta (publique).
 *
 * Réponse IDENTIQUE dans tous les cas valides (nouvelle demande, doublon fusionné,
 * adresse qui a déjà un compte ou une invitation, file d'attente pleine) : aucune
 * énumération. Seules la saisie invalide (400), le corps trop gros (413), l'origine
 * étrangère (403) et la limite de débit (429) se distinguent.
 */
export async function POST(req: NextRequest) {
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  if (!rateLimit(`beta-request:${clientIp(req.headers)}`, REQUEST_MAX, REQUEST_WINDOW_MS)) return tooMany();
  if (!rateLimit("beta-request:all", GLOBAL_MAX, REQUEST_WINDOW_MS)) return tooMany();

  // Refus AVANT de lire le corps. Sans Content-Length (encodage fragmenté), la taille lue
  // est vérifiée ensuite.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > BODY_MAX_BYTES) {
    return NextResponse.json({ error: "Demande trop volumineuse." }, { status: 413 });
  }
  const raw = await req.text().catch(() => "");
  if (raw.length > BODY_MAX_BYTES) {
    return NextResponse.json({ error: "Demande trop volumineuse." }, { status: 413 });
  }
  let body: { email?: unknown; name?: unknown; message?: unknown; consent?: unknown } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const result = await submitAccessRequest({
    email: body?.email,
    name: body?.name,
    message: body?.message,
    consent: body?.consent,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
