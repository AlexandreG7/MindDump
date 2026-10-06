import { lookup as dnsLookup } from "dns/promises";
import { isIP } from "net";

/**
 * Récupération d'une image dont l'URL vient d'un appelant du MCP (IA), sans
 * permettre d'atteindre le réseau interne de la machine qui héberge le MCP
 * (SSRF) : localhost, adresses privées, lien-local (métadonnées cloud
 * 169.254.169.254), CGNAT, ULA, IPv4 mappée, etc. Chaque redirection est
 * revérifiée. Duplication volontairement minimale de src/lib/safeFetch.ts
 * (paquet npm séparé, pas d'import cross-paquet) : garder les deux alignées
 * en cas de changement de l'un des deux côtés.
 */

export class UnsafeUrlError extends Error {}

// Indirection pour les tests (src/safeFetch.test.ts) : simuler une résolution
// DNS sans dépendre du réseau.
type LookupAll = (hostname: string) => Promise<{ address: string; family: number }[]>;
let lookup: LookupAll = (hostname) => dnsLookup(hostname, { all: true });
export function __setLookupForTests(fn: LookupAll | null): void {
  lookup = fn ?? ((hostname) => dnsLookup(hostname, { all: true }));
}

const MAX_REDIRECTS = 3;

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
  // IPv4 encapsulée (::ffff:10.0.0.1, ou ::ffff:a00:1 une fois normalisée) :
  // on juge l'IPv4.
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

/** Refuse une URL non http(s), avec identifiants, ou dont une adresse résolue est interne. */
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
    throw new UnsafeUrlError("URL invalide (identifiants non autorisés)");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new UnsafeUrlError("Adresse introuvable");
  if (addresses.some(isBlockedAddress)) throw new UnsafeUrlError("Adresse non autorisée");
  return url;
}

/**
 * GET d'une URL publique (image) : redirections revérifiées (3 maximum),
 * délai borné. L'appelant est responsable de limiter la taille lue (ici,
 * `checkSize` sur la taille déclarée et sur le buffer reçu).
 */
export async function safeFetch(
  raw: string,
  init: { headers?: Record<string, string>; timeoutMs: number }
): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeoutMs),
      headers: init.headers,
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
