import { randomBytes, timingSafeEqual } from "crypto";
import { useSecureCookies } from "./secureCookies";
import { hashLinkTicket } from "./mobileLink";

/**
 * Page de confirmation de la liaison depuis l'app (docs/oauth.md, « Fixation de
 * ticket »). Le ticket est un porteur dans l'URL : sans confirmation, un lien
 * piégé envoyé à une victime lui ferait lier SON Google au compte de l'attaquant.
 *
 * Le GET n'engage rien : il montre à qui appartient le ticket, et pose un cookie
 * SameSite=Strict (jamais envoyé par un formulaire d'un autre site) qui contient
 * un jeton aléatoire lié au ticket ; le même jeton est dans un champ caché. Le POST
 * exige les deux, et l'en-tête Origin du site.
 */

export const CONFIRM_COOKIE = {
  name: `${useSecureCookies ? "__Secure-" : ""}minddump.link-confirm`,
  options: {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "strict" as const,
    path: "/api/mobile-auth/start",
    maxAge: 10 * 60,
  },
};

export const newConfirmToken = () => randomBytes(24).toString("base64url");

/** Valeur du cookie : lie le jeton au ticket (empreinte du ticket). */
export const confirmCookieValue = (ticket: string, token: string) => `${hashLinkTicket(ticket)}.${token}`;

export function confirmationMatches(cookie: string | undefined, ticket: unknown, token: unknown): boolean {
  if (!cookie || typeof ticket !== "string" || typeof token !== "string" || token.length < 20) return false;
  const expected = Buffer.from(confirmCookieValue(ticket, token));
  const given = Buffer.from(cookie);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function confirmationPage(options: {
  providerName: string;
  name: string | null;
  email: string | null;
  ticket: string;
  token: string;
}): string {
  const who = options.name?.trim() ? options.name.trim() : "ce compte";
  const email = options.email?.trim() ?? "";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>Lier un compte</title>
<style>
  :root { --bg:#F9FAFB; --fg:#171C26; --muted:#5b6474; --card:#fff; --border:#e3e6ec; --primary:#E68037; --on-primary:#2a1808; }
  @media (prefers-color-scheme: dark) { :root { --bg:#212226; --fg:#e4e7ec; --muted:#a3a9b6; --card:#2a2b30; --border:#3a3c43; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center; background:var(--bg); color:var(--fg);
    font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding:max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left)); }
  main { width:100%; max-width:420px; background:var(--card); border:1px solid var(--border); border-radius:20px; padding:28px 24px; text-align:center; }
  h1 { font-size:1.25rem; line-height:1.35; margin:0 0 12px; }
  p { margin:0 0 24px; color:var(--muted); line-height:1.5; }
  .who { color:var(--fg); font-weight:600; }
  button { font:inherit; width:100%; min-height:48px; border-radius:14px; border:0; cursor:pointer; }
  .go { background:var(--primary); color:var(--on-primary); font-weight:600; margin-bottom:8px; }
  .no { background:transparent; color:var(--muted); text-decoration:underline; }
</style>
</head>
<body>
<main>
  <h1>Lier ton compte ${escapeHtml(options.providerName)} au compte MindDump de <span class="who">${escapeHtml(who)}</span>${email ? ` (<span class="who">${escapeHtml(email)}</span>)` : ""} ?</h1>
  <p>Continue seulement si c'est bien ton compte. Tu pourras ensuite te connecter avec ${escapeHtml(options.providerName)}. Si quelqu'un t'a envoyé ce lien, refuse.</p>
  <form method="post" action="/api/mobile-auth/start">
    <input type="hidden" name="ticket" value="${escapeHtml(options.ticket)}">
    <input type="hidden" name="token" value="${escapeHtml(options.token)}">
    <button class="go" type="submit" name="action" value="continue">Continuer</button>
    <button class="no" type="submit" name="action" value="cancel">Ce n'est pas mon compte</button>
  </form>
</main>
</body>
</html>`;
}
