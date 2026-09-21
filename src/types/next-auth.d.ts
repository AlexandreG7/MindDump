import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    // true une fois la politique de confidentialité acceptée (User.consentedAt).
    // Lu par le middleware pour rediriger vers /consentement.
    consented?: boolean;
  }
}
