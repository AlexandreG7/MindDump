import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

/**
 * Chiffrement au repos (AES-256-GCM) de petites données sensibles stockées en
 * base le temps d'un parcours (jetons OAuth en attente, src/lib/mobileLink.ts).
 * La clé dérive de NEXTAUTH_SECRET et d'un contexte : une valeur chiffrée pour
 * un usage ne se déchiffre pas pour un autre. Format : v1.iv.tag.texte (base64url).
 */
const key = (context: string) =>
  createHmac("sha256", String(process.env.NEXTAUTH_SECRET ?? "")).update(`minddump:${context}`).digest();

export function seal(plain: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(context), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Renvoie null si la valeur est altérée, d'un autre contexte, ou illisible. */
export function open(sealed: string, context: string): string | null {
  try {
    const [version, iv, tag, body] = sealed.split(".");
    if (version !== "v1" || !iv || !tag || body === undefined) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(context), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
