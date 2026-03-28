import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerGroupTools(server: McpServer) {
  // ─── Lister les groupes ────────────────────────────────────
  server.tool(
    "list_groups",
    "Lister tous les groupes dont l'utilisateur est membre ou propriétaire. Utile pour obtenir les groupId à passer aux autres outils.",
    {},
    async () => {
      try {
        const data = await client.get<{
          owned: Array<Record<string, unknown>>;
          member: Array<Record<string, unknown>>;
        }>("/api/groups");

        const allGroups = [...(data.owned || []), ...(data.member || [])];

        if (allGroups.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Aucun groupe trouvé." }],
          };
        }

        const summary = allGroups
          .map((g: Record<string, unknown>) => {
            const isDefault = g.isDefault ? " (par défaut)" : "";
            const count = (g._count as Record<string, number>)?.members || "?";
            return `- **${g.name}** (id: ${g.id})${isDefault} — ${count} membre(s)`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `${allGroups.length} groupe(s) :\n\n${summary}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Erreur: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
