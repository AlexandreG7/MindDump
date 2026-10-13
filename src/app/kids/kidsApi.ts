/**
 * Appels de l'interface du Semainier vers /api/kids/*. Une seule porte d'entrée :
 * les erreurs sont normalisées ({error, code, accepted?}) et un 409 `outdated_client`
 * (onglet resté sur une ancienne version) prévient toute la page, qui propose de recharger.
 */

export const KIDS_OUTDATED_EVENT = "kids:outdated";

export interface KidsResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Message lisible renvoyé par l'API (ou message réseau). */
  error?: string;
  code?: string;
  accepted?: string[];
}

export async function kidsFetch<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<KidsResult<T>> {
  const { json, ...rest } = init ?? {};
  try {
    const res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* corps vide ou non JSON */
    }
    if (res.ok) return { ok: true, status: res.status, data: body as T };
    const err = (body ?? {}) as { error?: string; code?: string; accepted?: string[] };
    if (res.status === 409 && err.code === "outdated_client" && typeof window !== "undefined") {
      window.dispatchEvent(new Event(KIDS_OUTDATED_EVENT));
    }
    return { ok: false, status: res.status, data: null, error: err.error, code: err.code, accepted: err.accepted };
  } catch {
    return { ok: false, status: 0, data: null, error: "Pas de connexion. Réessaie dans un instant.", code: "network" };
  }
}

/** Pluriel simple pour les libellés d'interface. */
export const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
