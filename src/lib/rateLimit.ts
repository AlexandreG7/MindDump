/**
 * Limite de débit simple, EN MÉMOIRE. Aucun limiteur n'existait dans le projet.
 *
 * Limite assumée : le compteur vit dans le processus Node. MindDump tourne en une
 * seule instance (Coolify) : la limite est donc exacte, mais elle repart de zéro à
 * chaque redémarrage/déploiement, et ne serait PAS partagée si l'on passait à
 * plusieurs instances (il faudrait alors une table ou Redis). Ce n'est pas une
 * défense contre un attaquant qui change d'adresse IP à chaque requête : elle freine
 * l'essai de masse depuis une même adresse.
 */

type Bucket = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as { __rateBuckets?: Map<string, Bucket> };
const buckets = (globalForLimiter.__rateBuckets ??= new Map<string, Bucket>());
export const MAX_KEYS = 10_000;

/**
 * Garde la table sous MAX_KEYS : d'abord les fenêtres expirées, puis (attaque large,
 * table toujours pleine) les plus anciennes entrées dans l'ordre d'insertion de la
 * Map, par dixième. Jamais de `clear()` : un attaquant qui sature la table ne doit
 * pas remettre à zéro les compteurs des autres.
 */
function makeRoom(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, b] of Array.from(buckets)) if (b.resetAt <= now) buckets.delete(k);
  if (buckets.size < MAX_KEYS) return;
  let toEvict = buckets.size - MAX_KEYS + Math.ceil(MAX_KEYS / 10);
  for (const k of Array.from(buckets.keys())) {
    if (toEvict-- <= 0) break;
    buckets.delete(k);
  }
}

/** (Re)crée la fenêtre : supprimer avant d'insérer la replace en fin d'ordre d'insertion. */
function openWindow(key: string, windowMs: number, now: number, count: number) {
  buckets.delete(key);
  makeRoom(now);
  buckets.set(key, { count, resetAt: now + windowMs });
}

/** Compte une tentative. `true` si elle est autorisée, `false` si la limite est atteinte. */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    openWindow(key, windowMs, now, 1);
    return true;
  }
  bucket.count++;
  return bucket.count <= max;
}

/** Reste-t-il de la place pour cette clé ? Ne compte rien (voir `rateLimitFail`). */
export function rateLimitAllows(key: string, max: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  return !bucket || bucket.resetAt <= now || bucket.count < max;
}

/** Compte un ÉCHEC (connexion) sans rien refuser : à combiner avec `rateLimitAllows`. */
export function rateLimitFail(key: string, windowMs: number, now = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) openWindow(key, windowMs, now, 1);
  else bucket.count++;
}

/** Remet la clé à zéro (connexion réussie). */
export function rateLimitClear(key: string): void {
  buckets.delete(key);
}

/**
 * Clé de limitation pour une adresse : IPv4 telle quelle, IPv6 réduite à son préfixe /64
 * (une connexion domestique reçoit un /64 entier : sans cela, changer les 64 derniers
 * bits contournerait la limite). IPv4 mappée en IPv6 (::ffff:a.b.c.d) ramenée à l'IPv4.
 * Une valeur illisible reste telle quelle.
 */
export function ipKey(raw: string): string {
  const ip = raw.trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "").toLowerCase();
  const mapped = /^(?:0{0,4}:){2,5}(?:ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(":")) return ip;
  const halves = ip.split("::");
  if (halves.length > 2) return ip;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return ip;
  const groups = halves.length === 1 ? head : [...head, ...Array(missing).fill("0"), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return ip;
  return `${groups.slice(0, 4).map((g) => g.padStart(4, "0")).join(":")}::/64`;
}

/**
 * Adresse du client (clé de limitation, voir `ipKey`). Derrière le proxy de Coolify, il
 * AJOUTE l'adresse réelle à la fin de X-Forwarded-For : seule la dernière entrée est
 * fiable, celles qui la précèdent peuvent être inventées par le client. Sans en-tête :
 * une seule clé partagée (échec prudent : tout le monde dans le même seau).
 */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const get = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name);
    const value = headers[name];
    return Array.isArray(value) ? value[value.length - 1] ?? null : value ?? null;
  };
  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim();
    if (last) return ipKey(last);
  }
  const real = get("x-real-ip")?.trim();
  return real ? ipKey(real) : "unknown";
}
