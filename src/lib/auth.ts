import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { ensureDefaultGroup } from "./defaultGroup";
import { generateUniquePublicId } from "./publicId";
import { oauthCookies, oauthProviders } from "./authProviders";
import { useSecureCookies } from "./secureCookies";
import { isMobileDeviceActive } from "./mobileAuth";
import { isSignupAllowed } from "./signupAllowlist";

const LOGIN_HISTORY_MONTHS = 12;

/** Page de connexion avec le message « Les inscriptions sont fermées » (OAuthButtons.tsx). */
export const SIGNUP_CLOSED_URL = "/login?error=SignupClosed";

const prismaAdapter = PrismaAdapter(prisma);

export const authOptions: NextAuthOptions = {
  adapter: {
    ...prismaAdapter,
    // Filet de sécurité : NextAuth ne crée un utilisateur (première connexion
    // Google/Apple) que par ici. Le callback signIn refuse déjà proprement ;
    // ceci garantit qu'aucun chemin n'en crée un hors liste blanche. Le mode
    // « liaison » (accountLinking.ts) remplace createUser : il ne crée personne.
    createUser: async (data) => {
      if (!isSignupAllowed(data.email)) throw new Error("Inscriptions fermées");
      return prismaAdapter.createUser!(data);
    },
  },
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

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
    // Inscriptions fermées (src/lib/signupAllowlist.ts) : une première connexion
    // Google/Apple qui créerait un NOUVEL utilisateur hors liste est renvoyée vers
    // /login avec un message en français (pas l'écran d'erreur NextAuth). Les
    // connexions d'utilisateurs existants ne sont jamais concernées. (Le mode
    // « liaison » a son propre callback signIn, qui ne crée personne.)
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
      // E-mail déjà inscrit : NextAuth ne crée rien (refus « compte existant »,
      // voir docs/oauth.md), c'est le parcours de liaison depuis le profil.
      if (email && (await prisma.user.findUnique({ where: { email }, select: { id: true } }))) {
        return true;
      }
      return isSignupAllowed(email) ? true : SIGNUP_CLOSED_URL;
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
