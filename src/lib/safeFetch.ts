import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Récupération d'une URL fournie par un utilisateur (abonnement calendrier),
 * sans permettre d'atteindre le réseau interne du serveur (SSRF) : localhost,
 * adresses privées, lien-local (métadonnées cloud 169.254.169.254), etc.
 * Chaque redirection est revérifiée.
 */

export class UnsafeUrlError extends Error {}

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
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
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
