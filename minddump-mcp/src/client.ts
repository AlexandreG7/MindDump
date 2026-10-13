import { config } from "./config.js";

/**
 * Client HTTP pour appeler l'API MindDump.
 * Gère l'authentification par API Key et le format JSON.
 */

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | undefined>;
}

/** Erreur de l'API : garde le statut, le code et la liste `accepted` (valeurs acceptables). */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public accepted?: string[]
  ) {
    super(message);
  }
}

function apiError(method: string, path: string, response: Response, data: unknown): ApiError {
  const body = (data ?? {}) as { error?: string; code?: string; accepted?: unknown };
  const accepted = Array.isArray(body.accepted) ? body.accepted.map(String) : undefined;
  const msg = body.error || response.statusText;
  const list = accepted?.length ? ` Valeurs acceptées : ${accepted.join(", ")}.` : "";
  return new ApiError(
    `API ${method} ${path} failed (${response.status}): ${msg}${list}`,
    response.status,
    typeof body.code === "string" ? body.code : undefined,
    accepted
  );
}

export class MindDumpClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.apiUrl;
    this.apiKey = config.apiKey;
  }

  private buildUrl(path: string, params?: Record<string, string | undefined>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, params } = options;

    const url = this.buildUrl(path, params);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw apiError(method, path, response, data);

    return data as T;
  }

  // ─── Raccourcis ────────────────────────────────────────────

  get<T = unknown>(path: string, params?: Record<string, string | undefined>) {
    return this.request<T>(path, { params });
  }

  post<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: "POST", body });
  }

  patch<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PATCH", body });
  }

  delete<T = unknown>(path: string, body?: unknown) {
    return this.request<T>(path, { method: "DELETE", body });
  }

  /** Envoi multipart (fichiers). Le Content-Type est posé par fetch. */
  async upload<T = unknown>(path: string, form: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.buildUrl(path), { method: "POST", headers, body: form });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw apiError("POST", path, response, data);

    return data as T;
  }
}

export const client = new MindDumpClient();
