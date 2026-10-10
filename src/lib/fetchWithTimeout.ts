/**
 * fetch avec délai maximal. Au retour d'arrière-plan ou après un changement de
 * réseau (Wi-Fi vers 4G), une requête peut rester en attente sur une connexion
 * morte pendant une minute ou plus : sans limite, les écrans qui attendent sa
 * réponse restent vides jusqu'à ce que l'utilisateur relance l'app.
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}
