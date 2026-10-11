import { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { ensureDefaultGroup } from "./defaultGroup";
import { generateUniquePublicId } from "./publicId";
import { oauthCookies, oauthProviders } from "./authProviders";
import { useSecureCookies } from "./secureCookies";
import { isMobileDeviceActive } from "./mobileAuth";
import { allowedSignupEmails, isSignupAllowed } from "./signupAllowlist";
import { findUserByEmail, parseEmail } from "./email";
import {
  INVITE_EMAIL_MISMATCH_URL,
  createUserWithGrant,
  findValidInvite,
} from "./signupInvite";

const LOGIN_HISTORY_MONTHS = 12;

/** Page de connexion avec le message « Les inscriptions sont fermées » (OAuthButtons.tsx). */
export const SIGNUP_CLOSED_URL = "/login?error=SignupClosed";

const prismaAdapter = PrismaAdapter(prisma);

// Lit la variable une fois au démarrage : une entrée invalide est signalée dans les
// journaux tout de suite, pas à la première inscription (signupAllowlist.ts).
allowedSignupEmails();

/** `email_verified` des fournisseurs : booléen (Google) ou chaîne « true » (Apple). */
const providerEmailVerified = (profile: unknown) => {
  const value = (profile as { email_verified?: unknown } | undefined)?.email_verified;
  return value === true || value === "true";
};

/**
 * Options NextAuth. `inviteToken` : jeton d'invitation lu dans le cookie posé avant
 * Google/Apple (route [...nextauth]) ; sans lui, seule la liste blanche autorise une
 * création de compte. Le module exporte `authOptions` (sans invitation) et
 * `authOptionsWithInvite` pour le callback OAuth qui en porte une.
 */
export function authOptionsWithInvite(inviteToken?: string): NextAuthOptions {
  const adapter: Adapter = {
    ...prismaAdapter,
    // NextAuth cherche l'utilisateur par e-mail exact : un « Alice@… » existant ne
    // serait pas retrouvé pour « alice@… » et un doublon serait créé. Correspondance
    // exacte d'abord, puis sans casse si elle est unique.
    getUserByEmail: async (email) => {
      const user = await findUserByEmail(email);
      return user ? prismaAdapter.getUser!(user.id) : null;
    },
    // NextAuth ne crée un utilisateur (première connexion Google/Apple) que par ici.
    // Le callback signIn refuse déjà proprement ; ceci garantit qu'aucun chemin n'en
    // crée hors liste blanche ou sans invitation, et consomme l'invitation dans la
    // même transaction. Le mode « liaison » (accountLinking.ts) remplace createUser :
    // il ne crée personne.
    createUser: async (data: Omit<AdapterUser, "id">) => {
      const email = parseEmail(data.email);
      if (!email) throw new Error("Inscriptions fermées");
      const result = await createUserWithGrant(
        email,
        {
          name: data.name ?? null,
          image: data.image ?? null,
          emailVerified: data.emailVerified ?? null,
        },
        inviteToken
      );
      if (!result.ok) throw new Error(result.reason === "exists" ? "Compte existant" : "Inscriptions fermées");
      return { ...result.user, email: result.user.email as string };
    },
  };

  return {
    adapter,
    providers: [
      // Google, Apple (si leurs variables d'env sont définies), voir authProviders.ts
      ...oauthProviders(),

      // Email + mot de passe
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Mot de passe", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;

          // Correspondance exacte d'abord, puis sans tenir compte de la casse si elle
          // est unique : les comptes antérieurs à casse mixte se connectent toujours
          // (ADR 0001), et un compte en minuscules se retrouve quelle que soit la saisie.
          const user = await findUserByEmail(credentials.email);

          if (!user || !user.password) return null;

          const isValid = verifyPassword(credentials.password, user.password);
          if (!isValid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
          };
        },
      }),
    ],
    session: {
      strategy: "jwt",
    },
    cookies: oauthCookies(useSecureCookies),
    callbacks: {
      // Inscriptions sur invitation (src/lib/signupAllowlist.ts, signupInvite.ts) : une
      // première connexion Google/Apple qui créerait un NOUVEL utilisateur n'est acceptée
      // que si l'e-mail du fournisseur est vérifié ET (dans la liste blanche OU visé par
      // l'invitation du cookie). Sinon renvoi vers /login avec un message en français
      // (pas l'écran d'erreur NextAuth). Les connexions d'utilisateurs existants ne sont
      // jamais concernées. (Le mode « liaison » a son propre callback signIn.)
      async signIn({ user, account, profile }) {
        if (!account || account.type === "credentials") return true;
        // Compte Google/Apple déjà lié : connexion d'un utilisateur existant.
        const linked = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          select: { userId: true },
        });
        if (linked) return true;
        const email = user.email ?? (typeof profile?.email === "string" ? profile.email : null);
        // E-mail déjà inscrit (sans tenir compte de la casse) : NextAuth ne crée rien
        // (refus « compte existant », voir docs/oauth.md), c'est le parcours de liaison
        // depuis le profil.
        if (email && (await findUserByEmail(email))) return true;
        // Création : le fournisseur doit garantir que l'adresse est la sienne, sinon
        // quiconque pourrait s'inscrire avec l'adresse d'un autre.
        const wanted = parseEmail(email);
        if (!wanted || !providerEmailVerified(profile)) return SIGNUP_CLOSED_URL;
        if (isSignupAllowed(wanted)) return true;
        const invite = await findValidInvite(inviteToken);
        if (!invite) return SIGNUP_CLOSED_URL;
        return invite.email === wanted ? true : INVITE_EMAIL_MISMATCH_URL;
      },
      async jwt({ token, user }) {
        // Session de l'app mobile : appareil révoqué → plus de session (un jeton
        // sans `sub` ne donne pas d'utilisateur, voir session.ts).
        if (typeof token.deviceId === "string" && !(await isMobileDeviceActive(token.deviceId))) {
          return {};
        }
        if (user) {
          token.role = (user as { role?: string }).role ?? "user";
        }
        // Consentement RGPD : tant que le jeton ne le porte pas, on relit la base
        // (seuls les comptes sans consentement paient cette requête). Le jeton est
        // ainsi mis à jour après /consentement, via useSession().update().
        if (!token.consented && token.sub) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { consentedAt: true },
          });
          token.consented = !!dbUser?.consentedAt;
        }
        return token;
      },
      async session({ session, token }) {
        // Jeton vidé par le callback jwt (appareil révoqué) : session vide, que
        // useSession traite comme une déconnexion.
        if (!token.sub) return {} as typeof session;
        if (session.user && token.sub) {
          (session.user as { id?: string; role?: string }).id = token.sub;
          (session.user as { id?: string; role?: string }).role =
            (token.role as string) ?? "user";
        }
        return session;
      },
    },
    events: {
      // Historique des connexions pour le dashboard admin. On utilise l'event et non
      // le callback signIn : pour un premier login Google, le callback reçoit le
      // profil Google avant la création de l'utilisateur en base (pas encore d'id),
      // alors que l'event arrive après. Les deux se déclenchent pour Credentials.
      async signIn({ user, account }) {
        try {
          await prisma.$transaction([
            prisma.loginEvent.create({
              data: { userId: user.id, provider: account?.provider ?? null },
            }),
            prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            }),
          ]);
          // Durée de conservation annoncée dans /confidentialite : 12 mois.
          const cutoff = new Date();
          cutoff.setMonth(cutoff.getMonth() - LOGIN_HISTORY_MONTHS);
          await prisma.loginEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
        } catch (error) {
          // Une statistique ne doit jamais empêcher de se connecter.
          console.error("LoginEvent non enregistré", error);
        }
      },
      // Créer le groupe par défaut à la première connexion (Google OAuth ou autre)
      async createUser({ user }) {
        const publicId = await generateUniquePublicId();
        await prisma.user.update({
          where: { id: user.id },
          data: { publicId },
        });
        await ensureDefaultGroup(user.id, user.name);
      },
    },
    pages: {
      signIn: "/login",
    },
  };
}

export const authOptions: NextAuthOptions = authOptionsWithInvite();
