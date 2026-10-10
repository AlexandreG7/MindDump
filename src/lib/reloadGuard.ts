const KEY = "minddump-auto-reload-at";
const MIN_GAP_MS = 60_000;

/**
 * Recharge la page, au plus une fois par minute : une panne qui persiste
 * (serveur injoignable, erreur à chaque chargement) ne doit pas faire boucler
 * l'app. Renvoie false si le rechargement a été refusé.
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // sessionStorage indisponible : on recharge quand même, une seule fois ici.
  }
  window.location.reload();
  return true;
}

/** Erreur de chargement d'un morceau de JavaScript (déploiement entre-temps). */
export function isChunkLoadError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null | undefined;
  const text = `${e?.name ?? ""} ${e?.message ?? (typeof error === "string" ? error : "")}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    text
  );
}
