import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerGroupTools(server: McpServer) {
  // ─── Lister les groupes ────────────────────────────────────
  server.tool(
    "list_groups",
    "Lister tous les groupes dont l'utilisateur est membre ou propriétaire, avec les personnes de chaque foyer (membres et enfants sans compte). Utile pour obtenir les groupId à passer aux autres outils.",
    {},
    async () => {
      try {
        const data = await client.get<{
          owned: Array<Record<string, unknown>>;
          member: Array<Record<string, unknown>>;
        }>("/api/groups");

        const allGroups = [...(data.owned || []), ...(data.member || [])];
        const profiles = await client.get<
          Array<{ id: string; name: string; kind: string; groupId: string; userId: string | null }>
        >("/api/profiles");

        if (allGroups.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Aucun groupe trouvé." }],
          };
        }

        const summary = allGroups
          .map((g: Record<string, unknown>) => {
            const isDefault = g.isDefault ? " (par défaut)" : "";
            const count = (g._count as Record<string, number>)?.members || "?";
            const people = profiles
              .filter((p) => p.groupId === g.id)
              .map((p) => `  - ${p.name}${p.kind === "child" ? " (enfant)" : ""}${p.userId ? "" : " — sans compte"} (profileId: ${p.id})`)
              .join("\n");
            return `- **${g.name}** (id: ${g.id})${isDefault} — ${count} membre(s)${people ? `\n${people}` : ""}`;
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
