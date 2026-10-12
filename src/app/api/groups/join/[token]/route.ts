import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { normalizeEmail } from "@/lib/email";
import { isSignupGroupInviteToken } from "@/lib/groupInviteSignup";

// POST — rejoindre un groupe via token
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const invite = await prisma.groupInvite.findUnique({
    where: { token: params.token },
    include: { group: true },
  });

  if (!invite) return NextResponse.json({ error: "Invitation invalide" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "Invitation déjà utilisée" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Invitation expirée" }, { status: 410 });

  // Lien nominatif : seul le compte de cette adresse peut le prendre. Refusé AVANT de le réclamer,
  // donc sans le consommer : la bonne personne peut encore s'en servir.
  if (invite.email && normalizeEmail(invite.email) !== (user.email ? normalizeEmail(user.email) : null)) {
    return NextResponse.json({ error: "Cette invitation est destinée à une autre adresse" }, { status: 403 });
  }

  // Atomique : le lien est « réclamé » par un updateMany CONDITIONNEL (pas encore utilisé, encore
  // valide) dans la même transaction que la création de l'adhésion. Deux POST simultanés sur un
  // lien à usage unique : un seul passe (0 ligne pour l'autre), une seule adhésion. Déjà membre :
  // le lien est tout de même consommé, comme avant (`skipDuplicates` : pas d'erreur d'unicité,
  // qui annulerait la transaction). Les vérifications ci-dessus ne servent plus qu'aux messages.
  const joined = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.groupInvite.updateMany({
      where: { token: params.token, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;
    await tx.groupMember.createMany({
      data: [{ groupId: invite.groupId, userId: user.id, role: "member" }],
      skipDuplicates: true,
    });
    return true;
  });
  // Perdu face à une autre requête (ou expiré à l'instant) : même réponse qu'un lien déjà utilisé.
  if (!joined) return NextResponse.json({ error: "Invitation déjà utilisée" }, { status: 410 });

  return NextResponse.json({ groupId: invite.groupId, groupName: invite.group.name });
}

// GET — infos sur l'invitation (sans auth, pour afficher avant connexion)
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Route publique qui confirme l'existence d'un jeton : limite par adresse IP.
  if (!rateLimit(`group-join-info:${clientIp(req.headers)}`, 60, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans quelques minutes." }, { status: 429 });
  }
  const invite = await prisma.groupInvite.findUnique({
    where: { token: params.token },
    include: { group: { include: { owner: { select: { name: true } }, _count: { select: { members: true } } } } },
  });

  if (!invite) return NextResponse.json({ error: "Invitation invalide" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "Invitation déjà utilisée" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Invitation expirée" }, { status: 410 });

  return NextResponse.json({
    groupName: invite.group.name,
    ownerName: invite.group.owner.name,
    memberCount: invite.group._count.members,
    expiresAt: invite.expiresAt,
    // Ce lien permet-il aussi de créer un compte ? (src/lib/groupInviteSignup.ts : nominatif,
    // une seule inscription par lien.)
    // Seul un lien NOMINATIF à jeton de 32 caractères ouvre l'inscription ; un lien ouvert ne sert
    // qu'à rejoindre avec un compte existant.
    signupAllowed: !invite.signupClaimedAt && !!invite.email?.trim() && isSignupGroupInviteToken(invite.token),
    inviteEmail: invite.email?.trim().toLowerCase() || null,
  });
}
