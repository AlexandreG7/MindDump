/**
 * Appel minimal à l'API Messages d'Anthropic, sans SDK : un seul outil imposé,
 * dont l'entrée est la réponse structurée attendue.
 *
 * Configuration : ANTHROPIC_API_KEY (obligatoire pour activer l'import IA),
 * AI_IMPORT_MODEL, ANTHROPIC_BASE_URL (facultatifs).
 */

const API_URL = `${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`;
const DEFAULT_MODEL = "claude-sonnet-5";

export type ClaudeContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class ClaudeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Envoie le contenu et renvoie l'entrée de l'outil imposé, avec la consommation. */
export async function callClaudeTool<T>({
  system,
  content,
  tool,
  maxTokens = 4096,
  timeoutMs = 90_000,
}: {
  system: string;
  content: ClaudeContent[];
  tool: ClaudeTool;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ input: T; usage: { inputTokens: number; outputTokens: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeError("Import IA non configuré", 503);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_IMPORT_MODEL || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((e: unknown) => {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new ClaudeError(timedOut ? "L'analyse a pris trop de temps" : "Service d'analyse injoignable", 502);
  });

  if (!res.ok) {
    // Le détail (quota du compte, requête refusée…) reste dans les journaux du
    // serveur : il ne contient pas le document.
    const detail = await res.text().catch(() => "");
    console.error(`[ai] Anthropic ${res.status}: ${detail.slice(0, 500)}`);
    if (res.status === 429 || res.status === 529) throw new ClaudeError("Service d'analyse surchargé, réessaie dans un instant", 503);
    if (res.status === 400 || res.status === 413) throw new ClaudeError("Ce document n'a pas pu être lu", 422);
    throw new ClaudeError("Le service d'analyse a échoué", 502);
  }

  const data = await res.json();
  const block = Array.isArray(data.content)
    ? data.content.find((b: { type: string; name?: string }) => b.type === "tool_use" && b.name === tool.name)
    : null;
  if (!block) throw new ClaudeError("Réponse d'analyse inattendue", 502);

  return {
    input: block.input as T,
    usage: {
      inputTokens: Number(data.usage?.input_tokens) || 0,
      outputTokens: Number(data.usage?.output_tokens) || 0,
    },
  };
}
