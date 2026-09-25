import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { ensureDefaultGroup } from "./defaultGroup";
import { generateUniquePublicId } from "./publicId";
import { oauthCookies, oauthProviders } from "./authProviders";
import { useSecureCookies } from "./secureCookies";

const LOGIN_HISTORY_MONTHS = 12;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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
    async jwt({ token, user }) {
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
