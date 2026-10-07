import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import { randomBytes } from "crypto";
import { encode, decode } from "next-auth/jwt";
import { prisma } from "./prisma";
import { storePendingLinkAccount } from "./mobileLink";
import { useSecureCookies } from "./secureCookies";

/**
 * Liaison d'un fournisseur OAuth (Google, Apple) à un compte existant, depuis
 * le profil.
 *
 * NextAuth sait lier un fournisseur quand la personne est connectée : il lit le
 * cookie de session pendant le callback OAuth. Mais Apple revient par un POST
 * cross-site (form_post) où ce cookie SameSite=Lax n'est pas envoyé : sans
 * précaution, NextAuth créerait un NOUVEAU compte. On ne relâche pas le cookie de
 * session (il protège aussi toutes les routes API contre le CSRF). À la place :
 *
 * 1. POST /api/users/me/accounts (personne connectée) pose un cookie « intention
 *    de liaison » : JWT chiffré {userId, provider}, 10 minutes, limité à /api/auth.
 * 2. Sur le callback de CE fournisseur, la route NextAuth utilise
 *    linkAuthOptions() : l'adaptateur rattache le compte OAuth à userId au lieu de
 *    créer un utilisateur, et refuse un compte OAuth déjà lié à quelqu'un d'autre.
 * 3. Le cookie est effacé à la fin du callback, et à la déconnexion.
 *
 * L'intention porte un identifiant unique (nonce) que le bouton « Lier » met dans
 * l'URL de retour. Elle n'est honorée que si le callback appartient à CETTE
 * tentative : sans ce lien, une intention abandonnée pourrait rattacher le compte
 * Google/Apple d'une autre personne qui se connecte ensuite sur le même
 * navigateur (et l'ouvrir dans le compte de la première).
 */

const secure = useSecureCookies;
export const LINK_COOKIE = secure ? "__Secure-minddump.link-intent" : "minddump.link-intent";
const LINK_TTL_S = 10 * 60;

export const linkCookieOptions = {
  httpOnly: true,
  secure,
  // Doit survivre au retour en POST cross-site d'Apple (voir plus haut).
  sameSite: (secure ? "none" : "lax") as "none" | "lax",
  path: "/api/auth",
  maxAge: LINK_TTL_S,
};

// En-tête qui efface le cookie (mêmes attributs, sinon le navigateur l'ignore).
export const clearLinkCookieHeader = `${LINK_COOKIE}=; Path=/api/auth; Max-Age=0; HttpOnly${
  secure ? "; Secure; SameSite=None" : "; SameSite=Lax"
}`;

// Cookie où NextAuth mémorise l'URL de retour de la tentative en cours.
const CALLBACK_URL_COOKIE = secure ? "__Secure-next-auth.callback-url" : "next-auth.callback-url";

export interface LinkIntent {
  userId: string;
  provider: string;
  nonce: string;
  /** Liaison lancée depuis l'app mobile (src/lib/mobileLink.ts) : id du ticket. */
  ticketId?: string;
}

export function newLinkNonce(): string {
  return randomBytes(16).toString("hex");
}

export async function encodeLinkIntent(intent: LinkIntent): Promise<string> {
  return encode({
    token: {
      sub: intent.userId,
      provider: intent.provider,
      nonce: intent.nonce,
      purpose: "link-intent",
      ...(intent.ticketId ? { ticketId: intent.ticketId } : {}),
    },
    secret: process.env.NEXTAUTH_SECRET as string,
    maxAge: LINK_TTL_S,
  });
}

export async function decodeLinkIntent(value: string | undefined): Promise<LinkIntent | null> {
  if (!value) return null;
  try {
    const token = await decode({ token: value, secret: process.env.NEXTAUTH_SECRET as string });
    if (
      token?.purpose !== "link-intent" ||
      !token.sub ||
      typeof token.provider !== "string" ||
      typeof token.nonce !== "string"
    ) {
      return null;
    }
    return {
      userId: token.sub,
      provider: token.provider,
      nonce: token.nonce,
      ...(typeof token.ticketId === "string" ? { ticketId: token.ticketId } : {}),
    };
  } catch {
    return null;
  }
}

/** Nonce « li » de l'URL de retour de la tentative OAuth en cours (cookie de NextAuth). */
export function callbackNonce(cookies: { get(name: string): { value: string } | undefined }): string | null {
  const value = cookies.get(CALLBACK_URL_COOKIE)?.value;
  if (!value) return null;
  try {
    return new URL(value, "http://localhost").searchParams.get("li");
  } catch {
    return null;
  }
}

/** L'URL de retour de la tentative OAuth en cours porte-t-elle le nonce de l'intention ? */
export function callbackMatchesIntent(
  cookies: { get(name: string): { value: string } | undefined },
  intent: LinkIntent
): boolean {
  return callbackNonce(cookies) === intent.nonce;
}

// Où revenir après une tentative de liaison (lu par la section « Connexion » du profil).
const profileUrl = (status: string, provider: string) =>
  `/profile?link=${status}&provider=${encodeURIComponent(provider)}#connexion`;

/** Options NextAuth pour le callback OAuth qui porte une intention de liaison. */
export function linkAuthOptions(base: NextAuthOptions, intent: LinkIntent): NextAuthOptions {
  const adapter = base.adapter as Adapter;
  // Depuis l'app, le résultat revient à /api/mobile-auth/complete (pas au profil) ;
  // et lier n'est pas se connecter : pas d'entrée dans l'historique de connexion.
  const mobile = !!intent.ticketId;
  // E-mail du fournisseur, pour l'affichage (jamais utilisé pour rapprocher un compte).
  let pendingEmail: string | null = null;
  const resultUrl = (status: string, provider: string) =>
    mobile ? `/api/mobile-auth/complete?link=${status}` : profileUrl(status, provider);

  return {
    ...base,
    // Depuis l'app, le navigateur système peut porter la session de quelqu'un
    // d'autre : NextAuth y rattacherait le compte avant de regarder l'intention.
    // On la lui rend illisible ; seule l'intention (userId du ticket) compte.
    ...(mobile ? { jwt: { ...base.jwt, decode: async () => null } } : {}),
    adapter: {
      ...adapter,
      // Ne jamais basculer vers un autre compte à cause de l'email du fournisseur
      // (sans cela : erreur « compte existant » si l'email est déjà inscrit).
      getUserByEmail: async () => null,
      // Là où NextAuth créerait un utilisateur, on renvoie celui qui lie son compte.
      createUser: async () => {
        const user = await adapter.getUser!(intent.userId);
        if (!user) throw new Error("Utilisateur à lier introuvable");
        return user as AdapterUser;
      },
      // Depuis l'app : l'Account n'est PAS créé ici. L'identité est mise en attente
      // sur le ticket et ne devient un Account qu'à l'échange du code par la session
      // du titulaire du ticket (src/lib/mobileLink.ts) : un lien piégé ne lie rien.
      ...(mobile
        ? {
            linkAccount: async (account: AdapterAccount) => {
              const ok = await storePendingLinkAccount(
                intent.ticketId as string,
                intent.userId,
                account as unknown as Record<string, unknown> & { provider: string; providerAccountId: string },
                pendingEmail
              );
              if (!ok) throw new Error("Parcours de liaison introuvable ou expiré");
            },
          }
        : {}),
    },
    callbacks: {
      ...base.callbacks,
      async signIn({ account, profile }) {
        pendingEmail = typeof profile?.email === "string" ? profile.email : null;
        if (!account || account.provider !== intent.provider) return resultUrl("error", intent.provider);
        const existing = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          select: { userId: true },
        });
        // Ce compte Google/Apple appartient déjà à un autre utilisateur MindDump.
        if (existing && existing.userId !== intent.userId) {
          return resultUrl("taken", intent.provider);
        }
        return true;
      },
    },
    events: {
      ...base.events,
      // Pas un nouveau compte : pas d'identifiant public ni de groupe par défaut.
      createUser: async () => {},
      ...(mobile ? { signIn: async () => {} } : {}),
    },
  };
}

export { profileUrl as linkResultUrl };
