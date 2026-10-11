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
const MAX_KEYS = 10_000;

/** Compte une tentative. `true` si elle est autorisée, `false` si la limite est atteinte. */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of Array.from(buckets)) if (b.resetAt <= now) buckets.delete(k);
    // Toujours pleine (attaque large) : on repart de zéro plutôt que de grossir sans fin.
    if (buckets.size > MAX_KEYS) buckets.clear();
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= max;
}

/**
 * Adresse du client. Derrière le proxy de Coolify, il AJOUTE l'adresse réelle à
 * la fin de X-Forwarded-For : seule la dernière entrée est fiable, celles qui la
 * précèdent peuvent être inventées par le client. Sans en-tête : une seule
 * clé partagée (échec prudent : tout le monde dans le même seau).
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim();
    if (last) return last;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
