import { lookup as dnsLookup } from "dns/promises";
import { isIP } from "net";

/**
 * Récupération d'une URL fournie par un utilisateur (abonnement calendrier),
 * sans permettre d'atteindre le réseau interne du serveur (SSRF) : localhost,
 * adresses privées, lien-local (métadonnées cloud 169.254.169.254), etc.
 * Chaque redirection est revérifiée.
 */

export class UnsafeUrlError extends Error {}

// Indirection pour les tests (src/lib/safeFetch.test.ts) : simuler une
// résolution DNS vers une IP privée sans dépendre d'un vrai réseau ni d'une
// mock ESM de "dns/promises" (fragile avec la transpilation CJS des tests).
// En production, toujours le vrai `dns/promises`. On n'appelle jamais
// `lookup` qu'avec `{ all: true }` ici, d'où ce type simplifié.
type LookupAll = (hostname: string) => Promise<{ address: string; family: number }[]>;
let lookup: LookupAll = (hostname) => dnsLookup(hostname, { all: true });
export function __setLookupForTests(fn: LookupAll | null): void {
  lookup = fn ?? ((hostname) => dnsLookup(hostname, { all: true }));
}

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // « ce réseau »
  ["10.0.0.0", 8], // privé
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // boucle locale
  ["169.254.0.0", 16], // lien-local, métadonnées cloud
  ["172.16.0.0", 12], // privé (réseaux Docker compris)
  ["192.0.0.0", 24],
  ["192.168.0.0", 16], // privé
  ["198.18.0.0", 15], // tests
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // réservé, broadcast
];

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4 encapsulée (::ffff:10.0.0.1, ou ::ffff:a00:1 une fois normalisée
  // par URL) : on juge l'IPv4.
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return isBlockedV4(dotted[1]);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isBlockedV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return (
    lower.startsWith("::") || // ::, ::1, IPv4 compatibles et autres formes réservées
    lower.startsWith("64:ff9b:") || // NAT64 vers une IPv4 quelconque
    lower.startsWith("fc") || // fc00::/7, adresses privées
    lower.startsWith("fd") ||
    /^fe[89ab]/.test(lower) || // fe80::/10, lien-local
    lower.startsWith("ff") // multicast
  );
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true;
}

/** Refuse une URL non http(s) ou dont une adresse résolue est interne. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL invalide");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("URL invalide (http/https uniquement)");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Identifiants non autorisés dans l'URL");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new UnsafeUrlError("Adresse introuvable");
  // Tests en local uniquement (calendrier servi sur localhost) ; jamais en production.
  if (process.env.NODE_ENV !== "production" && process.env.ALLOW_PRIVATE_URLS === "true") return url;
  if (addresses.some(isBlockedAddress)) throw new UnsafeUrlError("Adresse non autorisée");
  return url;
}

/** GET d'une URL publique : redirections revérifiées, délai et taille bornés. */
export async function safeFetchText(raw: string): Promise<string> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      headers: { "User-Agent": "MindDump/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Redirection sans destination (${res.status})`);
      current = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new Error("Fichier trop volumineux");
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error("Fichier trop volumineux");
    return text;
  }
  throw new Error("Trop de redirections");
}

/**
 * Pour les hôtes de la liste blanche (HelloFresh, Jow, Quitoque) : si l'URL
 * est en http: et que l'hôte correspond (sans identifiants, port standard),
 * la réécrit en https: — un vieux lien partagé en http (ex: notification,
 * copier-coller) ne doit pas être refusé puisque ces sites répondent tous en
 * https. Le fetch réel part toujours en https (voir `fetchAllowedUrl`).
 * Toute autre URL (hôte hors liste, userinfo, port non standard, protocole
 * exotique) est renvoyée inchangée : `isAllowedUrl` la jugera ensuite.
 */
export function toAllowedHttps(raw: string, hostPattern: RegExp): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (url.protocol !== "http:" || url.username || url.password) return raw;
  if (url.port && url.port !== "80") return raw;
  if (!hostPattern.test(url.hostname)) return raw;
  url.protocol = "https:";
  url.port = "";
  return url.toString();
}

/**
 * Pour les imports de recettes (HelloFresh, Jow, Quitoque) : en plus du
 * blocage d'IP interne, l'hôte doit être dans une liste blanche ancrée
 * (évite "hellofresh.fr.evil.com", les userinfo "jow.fr@evil.com", les ports
 * non standards…). `new URL()` lève déjà sur les protocoles exotiques
 * (file:, gopher:) ou les URL malformées.
 */
export function isAllowedUrl(raw: string, hostPattern: RegExp): boolean {
  let url: URL;
  try {
    url = new URL(toAllowedHttps(raw, hostPattern));
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  return hostPattern.test(url.hostname);
}

/**
 * GET d'une URL dont l'hôte est dans la liste blanche `hostPattern`, avec la
 * même défense en profondeur que `safeFetchText` (DNS, redirections
 * revérifiées). À utiliser pour tout fetch d'une URL de recette fournie par
 * l'utilisateur (HelloFresh/Jow/Quitoque) : le site réel est connu, donc pas
 * besoin de laisser passer un hôte arbitraire.
 */
export async function fetchAllowedUrl(
  raw: string,
  hostPattern: RegExp,
  init?: { headers?: Record<string, string>; timeoutMs?: number }
): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Réécrit http: en https: pour un hôte de la liste blanche avant de
    // juger l'URL et de construire la requête : le fetch réel ne part
    // jamais en http, même si le lien d'origine (ou une redirection) l'était.
    const canonical = toAllowedHttps(current, hostPattern);
    if (!isAllowedUrl(canonical, hostPattern)) {
      throw new UnsafeUrlError("Hôte non autorisé");
    }
    const url = new URL(canonical);
    const host = url.hostname;
    const addresses = (await lookup(host).catch(() => [])).map((a) => a.address);
    if (addresses.length === 0) throw new UnsafeUrlError("Adresse introuvable");
    const allowPrivate = process.env.NODE_ENV !== "production" && process.env.ALLOW_PRIVATE_URLS === "true";
    if (!allowPrivate && addresses.some(isBlockedAddress)) {
      throw new UnsafeUrlError("Adresse non autorisée");
    }
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(init?.timeoutMs ?? TIMEOUT_MS),
      headers: init?.headers,
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new UnsafeUrlError(`Redirection sans destination (${res.status})`);
      current = new URL(location, url).toString();
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("Trop de redirections");
}
