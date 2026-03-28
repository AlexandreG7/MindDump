/**
 * Configuration du MCP MindDump.
 * Les valeurs viennent des variables d'environnement.
 */
export const config = {
  /** URL de base de l'API MindDump (sans slash final) */
  apiUrl: process.env.MINDDUMP_API_URL || "http://localhost:3000",

  /** API Key pour l'authentification MindDump */
  apiKey: process.env.MINDDUMP_API_KEY || "",

  /** Mode de transport : "stdio" (local) ou "sse" (distant) */
  transport: (process.env.MCP_TRANSPORT || "stdio") as "stdio" | "sse",

  /** Port du serveur HTTP en mode SSE */
  port: parseInt(process.env.MCP_PORT || "3001", 10),

  /** Secret pour authentifier les clients MCP en mode SSE */
  mcpSecret: process.env.MCP_SECRET || "",
};

export function validateConfig() {
  if (!config.apiKey) {
    console.error(
      "[MindDump MCP] MINDDUMP_API_KEY non définie. " +
        "Génère une clé via POST /api/auth/api-key sur ton app MindDump."
    );
  }
  if (config.transport === "sse" && !config.mcpSecret) {
    console.error(
      "[MindDump MCP] MCP_SECRET non défini en mode SSE. " +
        "Tout le monde pourra se connecter sans authentification !"
    );
  }
}
