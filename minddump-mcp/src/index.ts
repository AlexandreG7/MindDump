#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { config, validateConfig } from "./config.js";
import { registerRecipeTools } from "./tools/recipes.js";
import { registerTodoTools } from "./tools/todos.js";
import { registerShoppingTools } from "./tools/shopping.js";
import { registerGroupTools } from "./tools/groups.js";

// ─── Création du serveur MCP ─────────────────────────────────

validateConfig();

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "minddump",
    version: "1.0.0",
  });

  registerRecipeTools(server);
  registerTodoTools(server);
  registerShoppingTools(server);
  registerGroupTools(server);

  return server;
}

// ─── Mode STDIO (local, Claude Desktop / Claude Code) ────────

async function startStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MindDump MCP] Serveur démarré en mode stdio");
}

// ─── Mode distant (Claude mobile / web / n'importe quel client) ─
//
// Deux transports sur le même port :
// - Streamable HTTP sans état (POST /mcp, ou POST /sse) : chaque requête crée
//   son propre serveur, rien n'est gardé en mémoire → pas de « session
//   invalide » quand la connexion est coupée (proxy, mobile, redéploiement).
// - SSE historique (GET /sse + POST /messages) pour les clients qui ne
//   connaissent que ce transport. Session liée à la connexion ouverte.

const SSE_KEEPALIVE_MS = 25_000;

async function handleStreamableHttp(req: IncomingMessage, res: ServerResponse) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("[MindDump MCP] Erreur requête Streamable HTTP:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Erreur interne" }, id: null }));
    }
  }
}

async function startSSE() {
  // Map pour stocker les transports SSE actifs par session
  const sessions = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://localhost:${config.port}`);

    // ── CORS ──────────────────────────────────────────────
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── Authentification (si MCP_SECRET est configuré) ────
    if (config.mcpSecret) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${config.mcpSecret}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Non autorisé" }));
        return;
      }
    }

    // ── Health check ──────────────────────────────────────
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "minddump-mcp" }));
      return;
    }

    // ── Streamable HTTP (sans état) ───────────────────────
    // POST /sse aussi : les clients récents essaient d'abord Streamable HTTP
    // sur l'URL configurée, avant de se rabattre sur SSE.
    if ((url.pathname === "/mcp" || url.pathname === "/sse") && req.method === "POST") {
      await handleStreamableHttp(req, res);
      return;
    }
    // Un client Streamable HTTP envoie Mcp-Protocol-Version sur son GET
    // optionnel : ne pas lui ouvrir une session SSE historique.
    if (url.pathname === "/mcp" || (url.pathname === "/sse" && req.headers["mcp-protocol-version"])) {
      // Sans état : pas de flux GET ni de fermeture de session.
      res.writeHead(405, { "Content-Type": "application/json", Allow: "POST" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Méthode non autorisée" }, id: null }));
      return;
    }

    // ── SSE endpoint : le client se connecte ici ──────────
    if (url.pathname === "/sse" && req.method === "GET") {
      const server = createMcpServer();
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;

      sessions.set(sessionId, transport);
      console.error(`[MindDump MCP] Nouvelle session SSE: ${sessionId}`);

      // Commentaire SSE régulier : évite que le proxy coupe une connexion inactive.
      const keepalive = setInterval(() => res.write(": ping\n\n"), SSE_KEEPALIVE_MS);

      res.on("close", () => {
        clearInterval(keepalive);
        sessions.delete(sessionId);
        console.error(`[MindDump MCP] Session SSE fermée: ${sessionId}`);
      });

      await server.connect(transport);
      return;
    }

    // ── Messages endpoint : le client envoie ses requêtes ici
    if (url.pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId || !sessions.has(sessionId)) {
        console.error(`[MindDump MCP] Message pour une session inconnue: ${sessionId}`);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session invalide ou expirée, reconnecte le client MCP" }));
        return;
      }

      const transport = sessions.get(sessionId)!;
      await transport.handlePostMessage(req, res);
      return;
    }

    // ── 404 ───────────────────────────────────────────────
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(config.port, "0.0.0.0", () => {
    console.error(`[MindDump MCP] Serveur distant démarré sur http://0.0.0.0:${config.port}`);
    console.error(`[MindDump MCP]   → HTTP:     http://0.0.0.0:${config.port}/mcp (Streamable HTTP)`);
    console.error(`[MindDump MCP]   → SSE:      http://0.0.0.0:${config.port}/sse`);
    console.error(`[MindDump MCP]   → Messages: http://0.0.0.0:${config.port}/messages`);
    console.error(`[MindDump MCP]   → Health:   http://0.0.0.0:${config.port}/health`);
  });
}

// ─── Démarrage ───────────────────────────────────────────────

async function main() {
  if (config.transport === "sse") {
    await startSSE();
  } else {
    await startStdio();
  }
}

main().catch((error) => {
  console.error("[MindDump MCP] Erreur fatale:", error);
  process.exit(1);
});
