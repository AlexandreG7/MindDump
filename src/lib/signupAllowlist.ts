import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseEmail } from "./email";

/**
 * Adresses autorisées à créer un compte SANS lien (bêta privée), gérées par l'administrateur
 * dans /admin (onglet « Demandes d'accès », section « Adresses autorisées »). Elles vivent en
 * base (`AllowedSignupEmail`), à un seul endroit : plus aucune variable d'environnement.
 *
 * Une adresse peut créer un compte si elle est ici, OU si une invitation bêta valide la vise
 * (signupInvite.ts), OU si une invitation de foyer valide l'autorise (groupInviteSignup.ts).
 * Fermé par défaut : la table démarre vide.
 *
 * Ne concerne QUE la création d'un nouvel utilisateur. Un compte existant se connecte et lie
 * un fournisseur comme avant, et retirer une adresse d'ici ne touche jamais à un compte
 * existant (ADR 0001 : rien ne disparaît pour son auteur).
 *
 * Contrôle d'accès : `isSignupAllowed` est relu en base à chaque création (route
 * d'inscription, callback `signIn`, et SOUS LE VERROU d'adresse dans `createUserWithGrant`).
 */

export const SIGNUP_CLOSED_MESSAGE = "Les inscriptions sont fermées pour le moment.";

export const NOTE_MAX = 120;

/** Client Prisma ou client de transaction (verrou d'adresse tenu par l'appelant). */
type Db = Pick<Prisma.TransactionClient, "allowedSignupEmail">;

/** Cette adresse est-elle dans la table (création d'un NOUVEAU compte) ? Casse et espaces ignorés. */
export async function isSignupAllowed(email: unknown, db: Db = prisma): Promise<boolean> {
  const wanted = parseEmail(email);
  if (!wanted) return false;
  const row = await db.allowedSignupEmail.findUnique({ where: { email: wanted }, select: { id: true } });
  return !!row;
}

export interface AllowedEmail {
  id: string;
  email: string;
  note: string | null;
  createdAt: string;
}

export async function listAllowedEmails(): Promise<AllowedEmail[]> {
  const rows = await prisma.allowedSignupEmail.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return rows.map((r) => ({ id: r.id, email: r.email, note: r.note, createdAt: r.createdAt.toISOString() }));
}

export type AddResult =
  | { ok: true; entry: AllowedEmail }
  | { ok: false; reason: "invalid" | "duplicate" | "note-too-long" };

/**
 * Ajoute une adresse (normalisée ; ASCII strict : une saisie hors ASCII est refusée, jamais
 * « corrigée »). Même verrou par adresse que la création de compte (createUserWithGrant).
 */
export async function addAllowedEmail(raw: unknown, note: unknown, createdById: string): Promise<AddResult> {
  const email = parseEmail(raw);
  if (!email) return { ok: false, reason: "invalid" };
  const cleanNote = typeof note === "string" ? note.trim() : "";
  if (cleanNote.length > NOTE_MAX) return { ok: false, reason: "note-too-long" };
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
      const row = await tx.allowedSignupEmail.create({
        data: { email, note: cleanNote || null, createdById },
      });
      return {
        ok: true as const,
        entry: { id: row.id, email: row.email, note: row.note, createdAt: row.createdAt.toISOString() },
      };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "duplicate" };
    }
    throw e;
  }
}

/**
 * Retire une adresse de la table. Ne touche JAMAIS à un compte (ADR 0001) : seule la
 * possibilité de créer un nouveau compte disparaît. Verrou d'adresse : une inscription qui
 * se termine pendant le retrait est tranchée proprement, avant ou après.
 */
export async function removeAllowedEmail(id: string): Promise<"ok" | "not-found"> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.allowedSignupEmail.findUnique({ where: { id }, select: { email: true } });
    if (!row) return "not-found" as const;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.email}))`;
    const deleted = await tx.allowedSignupEmail.deleteMany({ where: { id } });
    return deleted.count === 0 ? ("not-found" as const) : ("ok" as const);
  });
}
