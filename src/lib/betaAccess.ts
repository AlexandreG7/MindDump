import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CONSENT_VERSION } from "./consent";
import { parseEmail } from "./email";

/**
 * Demandes d'accès à la bêta (page publique /register, traitement dans /admin).
 * Voir docs/rgpd.md « Demandes d'accès » pour la finalité et la durée de conservation.
 */

export const MESSAGE_MAX = 500;
export const NAME_MAX = 80;
/** Les demandes et invitations plus vieilles que ça sont supprimées (docs/rgpd.md). */
export const RETENTION_MONTHS = 6;

export type RequestStatus = "pending" | "invited" | "registered" | "refused";

export type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Enregistre une demande. Le RÉSULTAT NE DIT RIEN de ce qui s'est passé : l'appelant
 * répond « Merci, on revient vers toi » dans tous les cas valides (compte existant,
 * demande déjà déposée, invitation en cours, nouvelle demande), sans énumération.
 * Les erreurs renvoyées ne portent que sur la saisie elle-même.
 */
export async function submitAccessRequest(input: {
  email: unknown;
  name: unknown;
  message: unknown;
  consent: unknown;
}): Promise<SubmitResult> {
  const email = parseEmail(input.email);
  if (!email) return { ok: false, error: "Indique une adresse e-mail valide." };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false, error: "Indique ton prénom." };
  if (name.length > NAME_MAX) return { ok: false, error: "Ton prénom est trop long." };
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (message.length > MESSAGE_MAX) {
    return { ok: false, error: `Ton message est trop long (${MESSAGE_MAX} caractères maximum).` };
  }
  if (input.consent !== true) {
    return { ok: false, error: "Tu dois accepter la politique de confidentialité pour envoyer ta demande." };
  }

  await purgeOldBetaData().catch((e) => console.error("[beta] purge impossible", e));

  // Déjà un compte ou une invitation en cours : rien à enregistrer.
  const [user, invite] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
    prisma.signupInvite.findFirst({
      where: { email, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  ]);
  if (user || invite) return { ok: true };

  try {
    await prisma.betaAccessRequest.create({
      data: { email, name, message: message || null, consentVersion: CONSENT_VERSION },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") throw e;
    // Doublon fusionné : une seule demande par adresse. On met à jour le texte tant
    // qu'elle attend. Refusée, invitée ou inscrite : on ne la rouvre pas.
    await prisma.betaAccessRequest.updateMany({
      where: { email, status: "pending" },
      data: { name, message: message || null, updatedAt: new Date() },
    });
  }
  return { ok: true };
}

/** Supprime les demandes et invitations de plus de 6 mois (minimisation, RGPD). */
export async function purgeOldBetaData(): Promise<void> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  await prisma.signupInvite.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await prisma.betaAccessRequest.deleteMany({ where: { updatedAt: { lt: cutoff } } });
}

export interface AdminBetaRequest {
  id: string;
  email: string;
  name: string;
  message: string | null;
  status: RequestStatus;
  createdAt: string;
  /** Une invitation encore utilisable existe (lien à régénérer si perdu). */
  inviteExpiresAt: string | null;
}

export async function listBetaRequests(): Promise<AdminBetaRequest[]> {
  await purgeOldBetaData().catch((e) => console.error("[beta] purge impossible", e));
  const rows = await prisma.betaAccessRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      invites: {
        where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { expiresAt: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    message: r.message,
    status: r.status as RequestStatus,
    createdAt: r.createdAt.toISOString(),
    inviteExpiresAt: r.invites[0]?.expiresAt.toISOString() ?? null,
  }));
}

/** Refuse une demande et invalide ses liens. `false` si elle n'existe pas ou est déjà inscrite. */
export async function refuseBetaRequest(id: string): Promise<"ok" | "not-found" | "registered"> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.betaAccessRequest.findUnique({ where: { id }, select: { email: true, status: true } });
    if (!request) return "not-found" as const;
    if (request.status === "registered") return "registered" as const;
    const now = new Date();
    await tx.signupInvite.updateMany({
      where: { email: request.email, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.betaAccessRequest.update({ where: { id }, data: { status: "refused", decidedAt: now } });
    return "ok" as const;
  });
}
