import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CONSENT_VERSION } from "./consent";
import { parseEmail } from "./email";

/**
 * Demandes d'accès à la bêta (page publique /register, traitement dans /admin).
 * Voir docs/rgpd.md « Demandes d'accès » pour la finalité et la durée de conservation
 * (la durée de la bêta ; aucune suppression automatique, effacement sur demande).
 */

export const MESSAGE_MAX = 500;
export const NAME_MAX = 80;
/**
 * Plafond de demandes « en attente » : au-delà, une demande valide reçoit la même réponse
 * mais n'est pas stockée (file d'attente admin noyée par du spam). `BETA_PENDING_CAP`
 * l'ajuste (tests, ou ajustement d'urgence sans redéploiement de code).
 */
export const DEFAULT_PENDING_CAP = 1000;
const pendingCap = () => {
  const fromEnv = Number(process.env.BETA_PENDING_CAP);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_PENDING_CAP;
};

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

  // Déjà un compte ou une invitation en cours : rien à enregistrer.
  const [user, invite] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
    prisma.signupInvite.findFirst({
      where: { email, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  ]);
  if (user || invite) return { ok: true };

  // File d'attente pleine : même réponse, rien de stocké. Journal sans l'adresse.
  const cap = pendingCap();
  if ((await prisma.betaAccessRequest.count({ where: { status: "pending" } })) >= cap) {
    console.warn(`[beta] plafond de ${cap} demandes en attente atteint : demande ignorée (file à vider dans /admin)`);
    return { ok: true };
  }

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

/** Adresse invitée par lien direct (sans demande d'accès) : un lien par adresse, le plus récent. */
export interface AdminDirectInvite {
  /** Identifiant de l'invitation la plus récente de cette adresse. */
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  status: "active" | "used" | "revoked" | "expired";
}

export interface AdminBetaRequestsPage {
  requests: AdminBetaRequest[];
  /** Liens directs (sans demande), pour les retrouver et les supprimer (RGPD). */
  directInvites: AdminDirectInvite[];
  /** Demandes en attente, toutes pages confondues (compteur de l'onglet). */
  pending: number;
  total: number;
  hasMore: boolean;
}

export const ADMIN_PAGE_SIZE = 50;
export const ADMIN_PAGE_MAX = 500;
const DIRECT_INVITES_MAX = 200;

async function listDirectInvites(): Promise<AdminDirectInvite[]> {
  const rows = await prisma.signupInvite.findMany({
    where: { requestId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DIRECT_INVITES_MAX,
  });
  const now = Date.now();
  const seen = new Set<string>();
  const out: AdminDirectInvite[] = [];
  for (const r of rows) {
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    out.push({
      id: r.id,
      email: r.email,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      status: r.usedAt ? "used" : r.revokedAt ? "revoked" : r.expiresAt.getTime() <= now ? "expired" : "active",
    });
  }
  return out;
}

/**
 * Demandes pour l'admin : « en attente » d'abord, puis le reste, chacun du plus récent au
 * plus ancien. Pagination par décalage sur cet ordre (`offset`, `limit`).
 */
export async function listBetaRequests(
  opts: { offset?: number; limit?: number } = {}
): Promise<AdminBetaRequestsPage> {
  const offset = Math.max(0, Math.floor(opts.offset ?? 0) || 0);
  const limit = Math.min(ADMIN_PAGE_MAX, Math.max(1, Math.floor(opts.limit ?? ADMIN_PAGE_SIZE) || ADMIN_PAGE_SIZE));

  const query = (where: Prisma.BetaAccessRequestWhereInput, skip: number, take: number) =>
    prisma.betaAccessRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        invites: {
          where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { expiresAt: true },
        },
      },
    });

  const [pending, others] = await Promise.all([
    prisma.betaAccessRequest.count({ where: { status: "pending" } }),
    prisma.betaAccessRequest.count({ where: { status: { not: "pending" } } }),
  ]);
  const first = offset < pending ? await query({ status: "pending" }, offset, limit) : [];
  const remaining = limit - first.length;
  const second = remaining > 0 ? await query({ status: { not: "pending" } }, Math.max(0, offset - pending), remaining) : [];
  const rows = [...first, ...second];

  return {
    directInvites: await listDirectInvites(),
    requests: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      message: r.message,
      status: r.status as RequestStatus,
      createdAt: r.createdAt.toISOString(),
      inviteExpiresAt: r.invites[0]?.expiresAt.toISOString() ?? null,
    })),
    pending,
    total: pending + others,
    hasMore: offset + rows.length < pending + others,
  };
}

/**
 * Refuse une demande et invalide ses liens. La mise à jour est CONDITIONNELLE et atomique
 * (`status != registered`) : une inscription qui se termine pendant le refus n'est jamais
 * repassée à « refusée ».
 */
export async function refuseBetaRequest(id: string): Promise<"ok" | "not-found" | "registered"> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.betaAccessRequest.findUnique({ where: { id }, select: { email: true } });
    if (!request) return "not-found" as const;
    // Même verrou par adresse que la création de compte (createUserWithGrant) : sans lui, les
    // deux transactions verrouillent invitation et demande dans l'ordre inverse (interblocage).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.email}))`;
    const now = new Date();
    const updated = await tx.betaAccessRequest.updateMany({
      where: { id, status: { not: "registered" } },
      data: { status: "refused", decidedAt: now, updatedAt: now },
    });
    if (updated.count === 0) {
      // Inscrite entre-temps, ou supprimée par un autre administrateur : on départage sans rien modifier.
      const still = await tx.betaAccessRequest.findUnique({ where: { id }, select: { id: true } });
      return still ? ("registered" as const) : ("not-found" as const);
    }
    await tx.signupInvite.updateMany({
      where: { email: request.email, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    return "ok" as const;
  });
}

/**
 * Supprime une demande d'accès, quel que soit son statut, et TOUTES les invitations qui s'y
 * rattachent (par `requestId` et par adresse normalisée), dans une transaction (RGPD :
 * effacement sur demande, docs/rgpd.md). Ne touche JAMAIS au compte : une personne déjà
 * inscrite garde le sien et tout ce qu'elle y a créé (ADR 0001).
 */
export async function deleteBetaRequest(id: string): Promise<"ok" | "not-found"> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.betaAccessRequest.findUnique({ where: { id }, select: { email: true } });
    if (!request) return "not-found" as const;
    // Même verrou par adresse que l'inscription (createUserWithGrant) et le refus : ordre
    // de verrouillage identique, donc pas d'interblocage avec une inscription simultanée.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.email}))`;
    await tx.signupInvite.deleteMany({ where: { OR: [{ requestId: id }, { email: request.email }] } });
    const deleted = await tx.betaAccessRequest.deleteMany({ where: { id } });
    // 0 : supprimée entre-temps (autre administrateur).
    return deleted.count === 0 ? ("not-found" as const) : ("ok" as const);
  });
}

/**
 * Supprime les liens directs (sans demande) d'une adresse, à partir de l'identifiant d'un
 * de ses liens. « not-found » si l'identifiant est inconnu ou rattaché à une demande
 * (à supprimer par `deleteBetaRequest`). Ne touche pas au compte.
 */
export async function deleteDirectInvites(inviteId: string): Promise<"ok" | "not-found"> {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.signupInvite.findUnique({ where: { id: inviteId }, select: { email: true, requestId: true } });
    if (!invite || invite.requestId) return "not-found" as const;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invite.email}))`;
    const deleted = await tx.signupInvite.deleteMany({ where: { email: invite.email, requestId: null } });
    return deleted.count === 0 ? ("not-found" as const) : ("ok" as const);
  });
}
