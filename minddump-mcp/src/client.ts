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

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = (data as { error?: string }).error || response.statusText;
      throw new Error(`API ${method} ${path} failed (${response.status}): ${errorMsg}`);
    }

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
}

export const client = new MindDumpClient();
