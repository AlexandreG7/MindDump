import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { isChallenge } from "./mobileAuth";
import { open, seal } from "./secretBox";

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
 *   callback NextAuth (intention) ── N'ÉCRIT PAS l'Account : l'identité obtenue (compte
 *        fournisseur, jetons chiffrés, e-mail) est mise EN ATTENTE sur le ticket ; refuse
 *        (« taken ») si ce compte est déjà lié à un autre ; le cookie de session n'est ni lu ni posé
 *   /api/mobile-auth/complete ── dépose code (60 s, SHA-256) + résultat sur le ticket
 *        ──▶ minddump://auth?code=…
 *   WebView ── POST /api/mobile-auth/link-exchange {code, verifier}
 *        exige la session de l'utilisateur du ticket ; vérifie PKCE et code ; PUIS SEULEMENT
 *        crée l'Account (transaction, contrainte unique), purge l'attente, renvoie le résultat
 *
 * Pourquoi différer : celui qui détient le ticket ne connaît pas le code (il part vers
 * l'app de la personne qui a fait l'OAuth). Sans échange réussi par la session du
 * titulaire du ticket, aucune liaison n'existe : un lien piégé ciblé ne peut pas
 * lier le Google d'une victime au compte d'un attaquant (docs/oauth.md).
 */

const TICKET_TTL_MS = 5 * 60 * 1000;
const CODE_TTL_MS = 60 * 1000;
// Durée maximale d'un parcours (ticket consommé → retour de l'OAuth) : celle du cookie du défi.
const FLOW_MAX_MS = 15 * 60 * 1000;
const PURGE_AFTER_MS = 60 * 60 * 1000;
/** Tickets actifs (non expirés, non consommés) autorisés par utilisateur. */
export const MAX_ACTIVE_TICKETS = 5;

export type LinkResult = "linked" | "taken" | "error";

const PENDING_CONTEXT = "mobile-link-pending";
const ACCOUNT_FIELDS = ["type", "refresh_token", "access_token", "expires_at", "token_type", "scope", "id_token", "session_state"] as const;
type PendingTokens = Partial<Record<(typeof ACCOUNT_FIELDS)[number], string | number | null>>;

/**
 * Mise en attente de l'identité OAuth obtenue (appelé par l'adaptateur de
 * linkAuthOptions à la place de la création de l'Account). Refuse un ticket qui
 * n'est pas en cours de parcours pour CET utilisateur.
 */
export async function storePendingLinkAccount(
  ticketId: string,
  userId: string,
  account: Record<string, unknown> & { provider: string; providerAccountId: string },
  email: string | null | undefined
) {
  const tokens: PendingTokens = {};
  for (const field of ACCOUNT_FIELDS) {
    const value = account[field];
    if (typeof value === "string" || typeof value === "number") tokens[field] = value;
  }
  const stored = await prisma.mobileLinkTicket.updateMany({
    where: {
      id: ticketId,
      userId,
      provider: account.provider,
      startedAt: { gt: new Date(Date.now() - FLOW_MAX_MS) },
      codeHash: null,
      exchangedAt: null,
    },
    data: {
      pendingProviderAccountId: account.providerAccountId,
      pendingEmail: typeof email === "string" ? email.slice(0, 320) : null,
      pendingTokens: seal(JSON.stringify(tokens), PENDING_CONTEXT),
    },
  });
  return stored.count === 1;
}

const NO_PENDING = { pendingProviderAccountId: null, pendingEmail: null, pendingTokens: null } as const;

/** Purge les identités en attente d'un parcours abandonné ou expiré, et les vieux tickets. */
async function purgeLinkTickets() {
  const now = Date.now();
  await prisma.mobileLinkTicket.updateMany({
    where: {
      pendingProviderAccountId: { not: null },
      OR: [
        { codeHash: null, startedAt: { lt: new Date(now - FLOW_MAX_MS) } },
        { codeExpiresAt: { lt: new Date(now) } },
      ],
    },
    data: NO_PENDING,
  });
  await prisma.mobileLinkTicket.deleteMany({ where: { createdAt: { lt: new Date(now - PURGE_AFTER_MS) } } });
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("base64url");
const isVerifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._~-]{43,128}$/.test(value);

/** Ticket de liaison pour l'utilisateur connecté (à n'appeler qu'avec sa session). */
export async function createLinkTicket(userId: string, provider: string, challenge: string) {
  if (!isChallenge(challenge)) return null;
  await purgeLinkTickets();
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
 * que le nom et l'e-mail du titulaire. Le détenteur du ticket les connaît déjà
 * (c'est SON compte) ; la victime d'un lien piégé y lit que ce n'est pas le sien.
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
  await purgeLinkTickets();
  const row = await prisma.mobileLinkTicket.findUnique({
    where: { ticketHash },
    select: { id: true, userId: true, provider: true },
  });
  return row;
}

/**
 * Retour du fournisseur : fixe le résultat sur le ticket et émet le code à usage
 * unique. Le résultat est lu en base (une identité est-elle bien en attente pour
 * l'utilisateur du ticket ?), jamais déduit d'un seul paramètre d'URL, sauf
 * « taken » / « error » qui ne peuvent que refuser (et purgent l'attente).
 * Aucun Account n'est créé ici : voir exchangeLinkCode.
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
    if (ticket && !ticket.codeHash) await prisma.mobileLinkTicket.update({ where: { id: ticket.id }, data: NO_PENDING });
    return null;
  }

  let result: LinkResult;
  if (status === "taken") result = "taken";
  else if (status === "error") result = "error";
  else if (ticket.pendingProviderAccountId && ticket.pendingTokens) result = "linked";
  else {
    // Rien en attente : « linked » seulement si CE compte fournisseur est déjà à l'utilisateur du ticket.
    const account = await prisma.account.findFirst({
      where: { userId: ticket.userId, provider: ticket.provider },
      select: { id: true },
    });
    result = account ? "linked" : "error";
  }

  const code = randomBytes(32).toString("base64url");
  const stored = await prisma.mobileLinkTicket.updateMany({
    where: { id: ticket.id, codeHash: null },
    data: {
      codeHash: sha256(code),
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      result,
      ...(result === "linked" ? {} : NO_PENDING),
    },
  });
  return stored.count === 1 ? code : null;
}

/**
 * Échange le code contre le résultat, et c'est ICI que l'Account est créé. Toute
 * tentative brûle le code (même ratée) et purge l'identité en attente, comme pour
 * la connexion. Refuse si la session n'est pas celle du ticket.
 */
export async function exchangeLinkCode(code: unknown, verifier: unknown, sessionUserId: string) {
  if (typeof code !== "string" || code.length > 200 || !isVerifier(verifier)) return null;
  const ticket = await prisma.mobileLinkTicket.findUnique({ where: { codeHash: sha256(code) } });
  if (!ticket) return null;

  const claimed = await prisma.mobileLinkTicket.updateMany({
    where: { id: ticket.id, exchangedAt: null },
    data: { exchangedAt: new Date(), ...NO_PENDING },
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

  let result = ticket.result as LinkResult | null;
  if (result === "linked") {
    result = ticket.pendingProviderAccountId && ticket.pendingTokens
      ? await createPendingAccount(ticket)
      : await existingAccountResult(ticket.userId, ticket.provider);
  }
  return { result: result ?? "error", provider: ticket.provider };
}

const existingAccountResult = async (userId: string, provider: string): Promise<LinkResult> =>
  (await prisma.account.findFirst({ where: { userId, provider }, select: { id: true } })) ? "linked" : "error";

/** Crée l'Account de l'identité en attente, en revérifiant qu'elle est encore libre. */
async function createPendingAccount(ticket: {
  userId: string;
  provider: string;
  pendingProviderAccountId: string | null;
  pendingTokens: string | null;
}): Promise<LinkResult> {
  const providerAccountId = ticket.pendingProviderAccountId;
  const opened = ticket.pendingTokens ? open(ticket.pendingTokens, PENDING_CONTEXT) : null;
  if (!providerAccountId || !opened) return "error";
  let tokens: PendingTokens;
  try {
    tokens = JSON.parse(opened);
  } catch {
    return "error";
  }
  const data: Record<string, string | number> = {};
  for (const field of ACCOUNT_FIELDS) {
    const value = tokens[field];
    if (typeof value === "string" || typeof value === "number") data[field] = value;
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const taken = await tx.account.findUnique({
        where: { provider_providerAccountId: { provider: ticket.provider, providerAccountId } },
        select: { userId: true },
      });
      if (taken) return taken.userId === ticket.userId ? "linked" : "taken";
      // Un seul compte par fournisseur et par utilisateur (le ticket est refusé en amont si déjà lié).
      const already = await tx.account.findFirst({
        where: { userId: ticket.userId, provider: ticket.provider },
        select: { id: true },
      });
      if (already) return "error";
      await tx.account.create({
        data: { type: "oauth", ...data, userId: ticket.userId, provider: ticket.provider, providerAccountId },
      });
      return "linked";
    });
  } catch (error) {
    // Contrainte unique (provider, providerAccountId) : liée à quelqu'un d'autre entre-temps.
    const code = (error as { code?: string })?.code;
    if (code === "P2002") return "taken";
    // Le message d'une erreur Prisma reprend les données (jetons) : on ne journalise que son type.
    console.error("[mobile-link] liaison impossible :", (error as Error)?.name ?? "Error", code ?? "");
    return "error";
  }
}
