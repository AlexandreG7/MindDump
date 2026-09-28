import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sendNotificationEmail } from "@/lib/mail";
import { siteUrl } from "@/lib/site";

/**
 * Mot de passe oublié.
 *
 * Réutilise la table VerificationToken de NextAuth (aucune migration) :
 * - identifier : l'adresse e-mail du compte, telle qu'enregistrée. La suppression
 *   du compte efface déjà les jetons de cet identifiant (src/lib/account.ts) ;
 * - token : l'empreinte SHA-256 du jeton envoyé par e-mail, jamais le jeton lui-même.
 *
 * Le jeton en clair ne vit que dans le lien de l'e-mail. Il sert une fois et
 * expire au bout d'une heure.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000;
// Pas plus d'un e-mail toutes les 2 minutes pour une même adresse.
const RESEND_DELAY_MS = 2 * 60 * 1000;

export const MIN_PASSWORD_LENGTH = 8;

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Envoie le lien de réinitialisation si un compte porte cette adresse. Ne dit
 * jamais à l'appelant si le compte existe : la route répond pareil dans tous les cas.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim();
  if (!email) return;

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const recent = await prisma.verificationToken.findFirst({
    where: {
      identifier: user.email,
      expires: { gt: new Date(Date.now() + TOKEN_TTL_MS - RESEND_DELAY_MS) },
    },
  });
  if (recent) return;

  // Un seul lien valable à la fois : le dernier envoyé.
  await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });

  const token = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token: digest(token),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${siteUrl}/reinitialiser-mot-de-passe?jeton=${token}`;
  const hello = user.name ? `Bonjour ${escapeHtml(user.name.split(" ")[0])},` : "Bonjour,";
  try {
    await sendNotificationEmail(
      user.email,
      "Choisis un nouveau mot de passe MindDump",
      `<p>${hello}</p>
<p>Tu as demandé à changer ton mot de passe MindDump. Ce lien est valable une heure :</p>
<p><a href="${link}">Choisir un nouveau mot de passe</a></p>
<p>Si ce n'est pas toi, ignore cet e-mail : ton mot de passe actuel reste valable.</p>`
    );
  } catch (err) {
    // Lien jamais parti : ne pas bloquer une nouvelle demande pendant 2 minutes.
    await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });
    throw err;
  }
}

export type ResetResult = "ok" | "invalid" | "too-short";

/** Consomme le jeton et enregistre le nouveau mot de passe. */
export async function resetPassword(token: string, newPassword: string): Promise<ResetResult> {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) return "too-short";
  if (!token) return "invalid";

  const stored = await prisma.verificationToken.findUnique({ where: { token: digest(token) } });
  if (!stored) return "invalid";
  if (stored.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token: stored.token } });
    return "invalid";
  }

  const user = await prisma.user.findUnique({ where: { email: stored.identifier }, select: { id: true } });
  if (!user) {
    await prisma.verificationToken.deleteMany({ where: { identifier: stored.identifier } });
    return "invalid";
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: hashPassword(newPassword) } }),
    prisma.verificationToken.deleteMany({ where: { identifier: stored.identifier } }),
    // Les sessions de l'app mobile tombent aussitôt (callback jwt). Les sessions
    // web, en JWT, restent valides jusqu'à leur expiration.
    prisma.mobileDevice.deleteMany({ where: { userId: user.id } }),
  ]);

  return "ok";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
