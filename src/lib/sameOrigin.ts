import { NextRequest, NextResponse } from "next/server";

/**
 * Origine du site : celle de NEXTAUTH_URL (le proxy de Coolify fait que l'origine déduite
 * de la requête n'est pas fiable), à défaut celle de la requête. Partagée avec le circuit
 * de liaison mobile (src/app/api/mobile-auth/start/route.ts).
 */
export function siteOrigin(req: NextRequest): string {
  try {
    return new URL(process.env.NEXTAUTH_URL || req.nextUrl.origin).origin;
  } catch {
    return req.nextUrl.origin;
  }
}

/**
 * Défense en profondeur contre les POST inter-sites (en plus de SameSite=Lax de la session) :
 * si l'en-tête Origin est PRÉSENT et diffère de l'origine du site (« null » compris),
 * renvoie une 403 à retourner telle quelle ; sinon `null`. Un Origin absent est toléré :
 * ce sont les clients sans navigateur (curl, tests), qui n'ont pas de cookie de session
 * à abuser ; les navigateurs l'envoient sur tout POST. (Le circuit mobile, lui, exige
 * l'Origin : il reçoit un formulaire HTML, voir start/route.ts.)
 *
 * Usage : `const denied = assertSameOrigin(req); if (denied) return denied;`
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (origin === null || origin === siteOrigin(req)) return null;
  return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
}
