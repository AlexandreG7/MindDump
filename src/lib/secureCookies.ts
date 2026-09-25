/**
 * Les cookies doivent-ils être marqués Secure (et donc préfixés __Secure-) ?
 *
 * Même règle que NextAuth : on suit NEXTAUTH_URL. Si elle n'est pas définie,
 * NextAuth déduit l'URL de la requête (donc HTTPS derrière le proxy de
 * production) : on retombe sur NODE_ENV pour rester cohérent avec lui, sinon les
 * noms de cookies divergeraient et la liaison OAuth casserait.
 */
export const useSecureCookies = process.env.NEXTAUTH_URL
  ? process.env.NEXTAUTH_URL.startsWith("https://")
  : process.env.NODE_ENV === "production";
