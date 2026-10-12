/**
 * Adresse de retour (`callbackUrl`) : chemin INTERNE du site uniquement, jamais une URL
 * externe. Les navigateurs retirent tabulations et retours à la ligne d'une URL avant de
 * l'analyser : « /\t/autre-site.fr » devient « //autre-site.fr » (redirection ouverte). On
 * refuse donc tout caractère de contrôle et toute barre oblique inverse, puis on vérifie
 * que l'analyse de l'URL reste sur l'origine du site.
 */
const PROBE = "http://internal.invalid";

export function safeCallbackPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    if (new URL(value, PROBE).origin !== PROBE) return fallback;
  } catch {
    return fallback;
  }
  return value;
}
