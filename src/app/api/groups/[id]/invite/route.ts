import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertSameOrigin } from "@/lib/sameOrigin";
import { parseEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { MAX_ACTIVE_GROUP_INVITES, activeGroupInviteWhere, groupInviteAccess } from "@/lib/groupInvites";

const INVITE_RATE = { max: 20, windowMs: 60 * 60 * 1000 };

const joinUrlOf = (token: string) => `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/groups/join/${token}`;

// POST — générer un lien d'invitation (valide 7 jours, 5 en attente au plus par groupe).
// Avec `email` (nominatif), la personne pourra aussi créer son compte ; sans, le lien sert
// seulement à rejoindre le foyer avec un compte existant (src/lib/groupInviteSignup.ts).
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = assertSameOrigin(req);
  if (denied) return denied;
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Propriétaire ou admin du groupe.
  const access = await groupInviteAccess(params.id, user.id);
  if (!access) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  if (!rateLimit(`group-invite:${user.id}`, INVITE_RATE.max, INVITE_RATE.windowMs)) {
    return NextResponse.json({ error: "Trop d'invitations créées. Réessaie dans quelques minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const rawEmail = body?.email;
  let email: string | null = null;
  if (rawEmail !== undefined && rawEmail !== null && !(typeof rawEmail === "string" && rawEmail.trim() === "")) {
    email = parseEmail(rawEmail);
    if (!email) return NextResponse.json({ error: "Indique une adresse e-mail valide." }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

  // Plafond tenu sous un verrou par groupe : deux créations simultanées ne dépassent pas 5.
  const invite = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group-invite:${params.id}`}))`;
    const active = await tx.groupInvite.count({ where: activeGroupInviteWhere(params.id) });
    if (active >= MAX_ACTIVE_GROUP_INVITES) return null;
    return tx.groupInvite.create({
      data: {
        groupId: params.id,
        // 32 caractères aléatoires : seuls ces jetons peuvent ouvrir une inscription.
        token: randomBytes(24).toString("base64url"),
        email,
        expiresAt,
      },
    });
  });
  if (!invite) {
    return NextResponse.json(
      { error: `${MAX_ACTIVE_GROUP_INVITES} invitations en attente au maximum : supprime-en une.` },
      { status: 409 }
    );
  }

  return NextResponse.json({ id: invite.id, token: invite.token, joinUrl: joinUrlOf(invite.token), email: invite.email, expiresAt });
}

// GET — lister les invitations en attente. Le jeton (donc le lien) n'est renvoyé qu'au
// propriétaire ou à un admin du groupe, comme pour la création ; un simple membre ne voit que
// le nombre et les échéances.
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await groupInviteAccess(params.id, user.id);
  if (!access) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  const invites = await prisma.groupInvite.findMany({
    where: activeGroupInviteWhere(params.id),
    orderBy: { expiresAt: "asc" },
  });

  return NextResponse.json(
    invites.map((i) =>
      access.canManage
        ? { id: i.id, email: i.email, token: i.token, joinUrl: joinUrlOf(i.token), expiresAt: i.expiresAt, signupClaimedAt: i.signupClaimedAt }
        : { id: i.id, expiresAt: i.expiresAt }
    )
  );
}
