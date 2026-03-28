import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerShoppingTools(server: McpServer) {
  // ─── Créer une liste de courses ────────────────────────────
  server.tool(
    "create_shopping_list",
    "Créer une nouvelle liste de courses dans MindDump",
    {
      name: z.string().describe("Nom de la liste (ex: 'Courses semaine', 'Carrefour')"),
      type: z
        .enum(["GROCERY", "ONLINE"])
        .optional()
        .default("GROCERY")
        .describe("Type de liste : GROCERY (magasin) ou ONLINE (en ligne)"),
      groupId: z.string().optional().describe("ID du groupe pour partager la liste"),
    },
    async (params) => {
      try {
        const list = await client.post("/api/lists", {
          name: params.name,
          type: params.type,
          groupId: params.groupId,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Liste "${params.name}" créée !\n\n${JSON.stringify(list, null, 2)}`,
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

  // ─── Lister les listes de courses ──────────────────────────
  server.tool(
    "list_shopping_lists",
    "Lister toutes les listes de courses avec leurs articles",
    {
      groupId: z.string().optional().describe("Filtrer par groupe (optionnel)"),
    },
    async (params) => {
      try {
        const lists = await client.get<Array<Record<string, unknown>>>("/api/lists", {
          groupId: params.groupId,
        });

        if (!Array.isArray(lists) || lists.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Aucune liste de courses trouvée." }],
          };
        }

        const summary = lists
          .map((l: Record<string, unknown>) => {
            const items = Array.isArray(l.items) ? l.items : [];
            const checked = items.filter((i: Record<string, unknown>) => i.checked).length;
            return `- **${l.name}** (id: ${l.id}, type: ${l.type}) — ${items.length} article(s), ${checked} coché(s)`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `${lists.length} liste(s) de courses :\n\n${summary}`,
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

  // ─── Ajouter des articles à une liste ─────────────────────
  server.tool(
    "add_to_shopping_list",
    "Ajouter un ou plusieurs articles à une liste de courses existante",
    {
      listId: z.string().describe("ID de la liste de courses"),
      items: z
        .array(
          z.object({
            name: z.string().describe("Nom de l'article (ex: 'Lait', 'Pain', 'Tomates')"),
            quantity: z.string().optional().describe("Quantité (ex: '1L', '500g', '6')"),
            category: z
              .string()
              .optional()
              .describe("Catégorie (ex: 'Fruits et légumes', 'Produits laitiers', 'Boulangerie')"),
            url: z.string().optional().describe("URL du produit (pour les listes en ligne)"),
            price: z.number().optional().describe("Prix du produit"),
            store: z.string().optional().describe("Nom du magasin"),
          })
        )
        .describe("Liste des articles à ajouter"),
    },
    async (params) => {
      try {
        const result = await client.post(`/api/lists/${params.listId}/items`, params.items);

        return {
          content: [
            {
              type: "text" as const,
              text: `${params.items.length} article(s) ajouté(s) à la liste !\n\nArticles : ${params.items.map((i) => `${i.name}${i.quantity ? ` (${i.quantity})` : ""}`).join(", ")}`,
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

  // ─── Voir le détail d'une liste ───────────────────────────
  server.tool(
    "get_shopping_list",
    "Voir tous les articles d'une liste de courses",
    {
      listId: z.string().describe("ID de la liste"),
    },
    async (params) => {
      try {
        const list = await client.get<Record<string, unknown>>(`/api/lists/${params.listId}`);
        const items = Array.isArray((list as Record<string, unknown>).items)
          ? ((list as Record<string, unknown>).items as Array<Record<string, unknown>>)
          : [];

        const itemsList = items
          .map((i: Record<string, unknown>) => {
            const check = i.checked ? "✅" : "⬜";
            const qty = i.quantity ? ` (${i.quantity})` : "";
            const cat = i.category ? ` [${i.category}]` : "";
            return `${check} ${i.name}${qty}${cat}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Liste "${(list as Record<string, unknown>).name}" — ${items.length} article(s) :\n\n${itemsList || "(vide)"}`,
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
