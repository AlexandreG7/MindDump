import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerTodoTools(server: McpServer) {
  // ─── Créer un todo ─────────────────────────────────────────
  server.tool(
    "create_todo",
    "Ajouter une tâche à faire dans MindDump. Peut être urgente ou planifiée, avec date d'échéance et notification.",
    {
      title: z.string().describe("Titre de la tâche"),
      description: z.string().optional().describe("Description détaillée"),
      priority: z
        .enum(["URGENT", "PLANNED"])
        .optional()
        .default("URGENT")
        .describe("Priorité : URGENT (défaut) ou PLANNED"),
      dueDate: z
        .string()
        .optional()
        .describe("Date d'échéance au format ISO 8601 (ex: 2026-04-01T10:00:00Z)"),
      notifyBefore: z
        .number()
        .optional()
        .describe("Envoyer une notification X minutes avant la date d'échéance"),
      groupId: z.string().optional().describe("ID du groupe pour partager la tâche"),
    },
    async (params) => {
      try {
        const todo = await client.post("/api/todos", {
          title: params.title,
          description: params.description,
          priority: params.priority,
          dueDate: params.dueDate,
          notifyBefore: params.notifyBefore,
          groupId: params.groupId,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Tâche "${params.title}" ajoutée !\n\n${JSON.stringify(todo, null, 2)}`,
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

  // ─── Lister les todos ──────────────────────────────────────
  server.tool(
    "list_todos",
    "Lister toutes les tâches à faire. Affiche les tâches non complétées en priorité.",
    {
      groupId: z.string().optional().describe("Filtrer par groupe (optionnel)"),
    },
    async (params) => {
      try {
        const todos = await client.get<Array<Record<string, unknown>>>("/api/todos", {
          groupId: params.groupId,
        });

        if (!Array.isArray(todos) || todos.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Aucune tâche trouvée." }],
          };
        }

        const summary = todos
          .map((t: Record<string, unknown>) => {
            const status = t.completed ? "✅" : "⬜";
            const priority = t.priority === "URGENT" ? "🔴" : "🔵";
            const due = t.dueDate
              ? ` — échéance: ${new Date(t.dueDate as string).toLocaleDateString("fr-FR")}`
              : "";
            return `${status} ${priority} **${t.title}** (id: ${t.id})${due}`;
          })
          .join("\n");

        const pending = todos.filter((t) => !t.completed).length;
        const done = todos.filter((t) => t.completed).length;

        return {
          content: [
            {
              type: "text" as const,
              text: `${todos.length} tâche(s) — ${pending} en cours, ${done} terminée(s) :\n\n${summary}`,
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

  // ─── Compléter un todo ─────────────────────────────────────
  server.tool(
    "complete_todo",
    "Marquer une tâche comme terminée",
    {
      todoId: z.string().describe("ID de la tâche à compléter"),
    },
    async (params) => {
      try {
        await client.patch(`/api/todos/${params.todoId}`, { completed: true });

        return {
          content: [
            {
              type: "text" as const,
              text: `Tâche ${params.todoId} marquée comme terminée !`,
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

  // ─── Modifier un todo ──────────────────────────────────────
  server.tool(
    "update_todo",
    "Modifier une tâche existante (titre, description, priorité, date d'échéance, statut)",
    {
      todoId: z.string().describe("ID de la tâche"),
      title: z.string().optional().describe("Nouveau titre"),
      description: z.string().optional().describe("Nouvelle description"),
      priority: z.enum(["URGENT", "PLANNED"]).optional().describe("Nouvelle priorité"),
      dueDate: z.string().optional().describe("Nouvelle date d'échéance (ISO 8601)"),
      completed: z.boolean().optional().describe("Marquer comme terminée ou non"),
    },
    async (params) => {
      try {
        const { todoId, ...updates } = params;
        await client.patch(`/api/todos/${todoId}`, updates);

        return {
          content: [
            {
              type: "text" as const,
              text: `Tâche ${todoId} mise à jour !`,
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
