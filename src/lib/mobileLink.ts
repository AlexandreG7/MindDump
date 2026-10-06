import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { isChallenge } from "./mobileAuth";

/**
 * Lier un compte Google/Apple depuis l'app mobile (docs/app-mobile.md, étape 3.2 ;
 * docs/oauth.md « Connexion depuis l'app mobile »).
 *
 * Même circuit que la connexion (navigateur système, PKCE, code à usage unique),
 * mais en mode « lier au compte connecté » : aucune session n'est ouverte, aucun
 * utilisateur n'est créé. L'utilisateur à lier est fixé AU DÉPART, par la WebView
 * connectée, et n'est ensuite lu que dans la base :
 *
 *   WebView (connectée) ── POST /api/mobile-auth/link-ticket {provider, challenge}
 *        ◀── ticket (5 min, usage unique ; SHA-256 stocké avec userId, provider, défi)
 *   navigateur système ── GET /api/mobile-auth/start?mode=link&ticket=…
 *        ne consomme rien : page de confirmation (nom et e-mail masqué du titulaire)
 *   navigateur système ── POST /api/mobile-auth/start (bouton « Continuer »)
 *        consomme le ticket, pose l'intention de liaison {userId du ticket, nonce}
 *        (src/lib/accountLinking.ts) et un cookie {ticketId}, puis lance OAuth
 *        (le POST exige le cookie SameSite=Strict et l'Origin du site : sans cela,
 *        un lien piégé ferait lier le compte Google de la victime au compte de
 *        l'attaquant, voir docs/oauth.md)
 *   callback NextAuth (intention) ── rattache le compte OAuth à CE userId, ou refuse
 *        (« taken » si déjà lié à un autre) ; le cookie de session n'est ni lu ni posé
 *   /api/mobile-auth/complete ── dépose code (60 s, SHA-256) + résultat sur le ticket
 *        ──▶ minddump://auth?code=…
 *   WebView ── POST /api/mobile-auth/link-exchange {code, verifier}
 *        exige la session de l'utilisateur du ticket ; vérifie PKCE ; renvoie le résultat
 */

const TICKET_TTL_MS = 5 * 60 * 1000;
const CODE_TTL_MS = 60 * 1000;
// Durée maximale d'un parcours (ticket consommé → retour de l'OAuth) : celle du cookie du défi.
const FLOW_MAX_MS = 15 * 60 * 1000;
const PURGE_AFTER_MS = 60 * 60 * 1000;
/** Tickets actifs (non expirés, non consommés) autorisés par utilisateur. */
export const MAX_ACTIVE_TICKETS = 5;

export type LinkResult = "linked" | "taken" | "error";

const sha256 = (value: string) => createHash("sha256").update(value).digest("base64url");
const isVerifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._~-]{43,128}$/.test(value);

/** Ticket de liaison pour l'utilisateur connecté (à n'appeler qu'avec sa session). */
export async function createLinkTicket(userId: string, provider: string, challenge: string) {
  if (!isChallenge(challenge)) return null;
  await prisma.mobileLinkTicket.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - PURGE_AFTER_MS) } },
  });
  const ticket = randomBytes(32).toString("base64url");
  await prisma.mobileLinkTicket.create({
    data: {
      ticketHash: sha256(ticket),
      userId,
      provider,
      challenge,
      expiresAt: new Date(Date.now() + TICKET_TTL_MS),
    },
  });
  return ticket;
}

export async function countActiveLinkTickets(userId: string) {
  return prisma.mobileLinkTicket.count({
    where: { userId, startedAt: null, expiresAt: { gt: new Date() } },
  });
}

const validTicket = (ticket: unknown): ticket is string =>
  typeof ticket === "string" && ticket.length >= 20 && ticket.length <= 200;

export const hashLinkTicket = sha256;

/**
 * Regarde le ticket SANS le consommer, pour la page de confirmation : ne renvoie
 * que le nom et l'e-mail du titulaire (que celui qui détient le ticket connaît déjà).
 */
export async function peekLinkTicket(ticket: unknown) {
  if (!validTicket(ticket)) return null;
  const row = await prisma.mobileLinkTicket.findUnique({
    where: { ticketHash: sha256(ticket) },
    select: { userId: true, provider: true, startedAt: true, expiresAt: true },
  });
  if (!row || row.startedAt || row.expiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { name: true, email: true },
  });
  if (!user) return null;
  return { provider: row.provider, name: user.name, email: user.email };
}

/** « Ce n'est pas mon compte » : le ticket ne servira plus. */
export async function cancelLinkTicket(ticket: unknown) {
  if (!validTicket(ticket)) return;
  await prisma.mobileLinkTicket.updateMany({
    where: { ticketHash: sha256(ticket), startedAt: null },
    data: { expiresAt: new Date() },
  });
}

/**
 * Consomme le ticket (usage unique, même si la suite échoue) et renvoie ce que
 * le navigateur système doit lier. Rien n'est lu dans l'URL en dehors du ticket.
 */
export async function startLinkFlow(ticket: unknown) {
  if (!validTicket(ticket)) return null;
  const ticketHash = sha256(ticket);
  const claimed = await prisma.mobileLinkTicket.updateMany({
    where: { ticketHash, startedAt: null, expiresAt: { gt: new Date() } },
    data: { startedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  const row = await prisma.mobileLinkTicket.findUnique({
    where: { ticketHash },
    select: { id: true, userId: true, provider: true },
  });
  return row;
}

/**
 * Retour du fournisseur : fixe le résultat sur le ticket et émet le code à usage
 * unique. Le résultat est lu en base (le compte est-il bien rattaché à l'utilisateur
 * du ticket ?), jamais déduit d'un seul paramètre d'URL, sauf « taken » / « error »
 * qui ne peuvent que refuser.
 */
export async function completeLinkFlow(ticketId: unknown, status: string | null) {
  if (typeof ticketId !== "string") return null;
  const ticket = await prisma.mobileLinkTicket.findUnique({ where: { id: ticketId } });
  if (
    !ticket ||
    !ticket.startedAt ||
    ticket.codeHash ||
    ticket.startedAt.getTime() < Date.now() - FLOW_MAX_MS
  ) {
    return null;
  }

  let result: LinkResult;
  if (status === "taken") result = "taken";
  else if (status === "error") result = "error";
  else {
    const account = await prisma.account.findFirst({
      where: { userId: ticket.userId, provider: ticket.provider },
      select: { id: true },
    });
    result = account ? "linked" : "error";
  }

  const code = randomBytes(32).toString("base64url");
  const stored = await prisma.mobileLinkTicket.updateMany({
    where: { id: ticket.id, codeHash: null },
    data: { codeHash: sha256(code), codeExpiresAt: new Date(Date.now() + CODE_TTL_MS), result },
  });
  return stored.count === 1 ? code : null;
}

/**
 * Échange le code contre le résultat. Toute tentative brûle le code (même ratée),
 * comme pour la connexion. Refuse si la session n'est pas celle du ticket.
 */
export async function exchangeLinkCode(code: unknown, verifier: unknown, sessionUserId: string) {
  if (typeof code !== "string" || code.length > 200 || !isVerifier(verifier)) return null;
  const ticket = await prisma.mobileLinkTicket.findUnique({ where: { codeHash: sha256(code) } });
  if (!ticket) return null;

  const claimed = await prisma.mobileLinkTicket.updateMany({
    where: { id: ticket.id, exchangedAt: null },
    data: { exchangedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  if (
    !ticket.codeExpiresAt ||
    ticket.codeExpiresAt < new Date() ||
    sha256(verifier) !== ticket.challenge ||
    ticket.userId !== sessionUserId
  ) {
    return null;
  }

  // Dernier regard sur la base : « linked » seulement si le compte est bien à CET utilisateur.
  let result = ticket.result as LinkResult | null;
  if (result === "linked") {
    const account = await prisma.account.findFirst({
      where: { userId: ticket.userId, provider: ticket.provider },
      select: { id: true },
    });
    if (!account) result = "error";
  }
  return { result: result ?? "error", provider: ticket.provider };
}
