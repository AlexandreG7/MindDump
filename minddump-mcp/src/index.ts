#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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

// ─── Mode SSE (distant, Claude mobile / web / n'importe quel client) ─

async function startSSE() {
  // Map pour stocker les transports SSE actifs par session
  const sessions = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://localhost:${config.port}`);

    // ── CORS ──────────────────────────────────────────────
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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

    // ── SSE endpoint : le client se connecte ici ──────────
    if (url.pathname === "/sse" && req.method === "GET") {
      const server = createMcpServer();
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;

      sessions.set(sessionId, transport);
      console.error(`[MindDump MCP] Nouvelle session SSE: ${sessionId}`);

      res.on("close", () => {
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
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session invalide" }));
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
    console.error(`[MindDump MCP] Serveur SSE démarré sur http://0.0.0.0:${config.port}`);
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
