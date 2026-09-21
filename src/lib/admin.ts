import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * Renvoie l'utilisateur connecté s'il est administrateur, sinon null.
 *
 * Choix de sécurité (volontairement plus stricts que getSessionUser()) :
 * - Session NextAuth uniquement. Une clé API (Bearer mdk_...) ne donne JAMAIS
 *   accès à l'admin : ces clés sont faites pour le MCP, sont stockées chez des
 *   tiers (Claude Desktop…) et n'ont pas besoin de ce périmètre.
 * - Le bypass SKIP_AUTH (devAuth.ts) est ignoré : le "dev-user" n'est jamais
 *   admin, quel que soit l'environnement.
 * - Le rôle est relu en base à chaque appel plutôt que pris dans le JWT : une
 *   rétrogradation prend effet immédiatement, sans attendre l'expiration du jeton.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user || user.role !== "admin") return null;

  return { id: user.id, email: user.email, name: user.name };
}

/**
 * À appeler en tête de CHAQUE route API sous /api/admin :
 *
 *   const admin = await requireAdmin();
 *   if (admin instanceof NextResponse) return admin;
 *
 * Renvoie 401 sans session, 403 si la session n'est pas administrateur.
 */
export async function requireAdmin(): Promise<AdminUser | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
  }
  return admin;
}
