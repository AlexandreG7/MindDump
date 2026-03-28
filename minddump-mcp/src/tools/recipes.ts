import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerRecipeTools(server: McpServer) {
  // ─── Créer une recette ──────────────────────────────────────
  server.tool(
    "create_recipe",
    "Créer une nouvelle recette dans MindDump. Utilise ce tool après avoir extrait une recette d'une photo ou d'une description.",
    {
      title: z.string().describe("Nom de la recette"),
      description: z.string().optional().describe("Description courte de la recette"),
      servings: z.number().optional().default(4).describe("Nombre de portions"),
      prepTime: z.number().optional().describe("Temps de préparation en minutes"),
      cookTime: z.number().optional().describe("Temps de cuisson en minutes"),
      steps: z.array(z.string()).describe("Liste des étapes de la recette"),
      ingredients: z
        .array(
          z.object({
            name: z.string().describe("Nom de l'ingrédient"),
            quantity: z.string().describe("Quantité (ex: '200', '2', '1/2')"),
            unit: z.string().optional().describe("Unité (ex: 'g', 'ml', 'pièce', 'cuillère à soupe')"),
          })
        )
        .describe("Liste des ingrédients"),
      groupId: z.string().optional().describe("ID du groupe pour partager la recette (optionnel)"),
      planned: z.boolean().optional().default(false).describe("Marquer comme recette planifiée"),
    },
    async (params) => {
      try {
        const recipe = await client.post("/api/recipes", {
          title: params.title,
          description: params.description,
          servings: params.servings,
          prepTime: params.prepTime,
          cookTime: params.cookTime,
          steps: params.steps,
          ingredients: params.ingredients,
          groupId: params.groupId,
          planned: params.planned,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Recette "${params.title}" créée avec succès !\n\n${JSON.stringify(recipe, null, 2)}`,
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

  // ─── Lister les recettes ────────────────────────────────────
  server.tool(
    "list_recipes",
    "Lister toutes les recettes sauvegardées dans MindDump",
    {
      groupId: z.string().optional().describe("Filtrer par groupe (optionnel)"),
    },
    async (params) => {
      try {
        const recipes = await client.get<Array<Record<string, unknown>>>("/api/recipes", {
          groupId: params.groupId,
        });

        if (!Array.isArray(recipes) || recipes.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Aucune recette trouvée." }],
          };
        }

        const summary = recipes
          .map((r: Record<string, unknown>) => {
            const ingredients = Array.isArray(r.ingredients) ? r.ingredients.length : 0;
            const time = [
              r.prepTime ? `prep: ${r.prepTime}min` : null,
              r.cookTime ? `cuisson: ${r.cookTime}min` : null,
            ]
              .filter(Boolean)
              .join(", ");
            return `- **${r.title}** (id: ${r.id}) — ${r.servings} portions, ${ingredients} ingrédients${time ? `, ${time}` : ""}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `${recipes.length} recette(s) trouvée(s) :\n\n${summary}`,
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

  // ─── Voir le détail d'une recette ──────────────────────────
  server.tool(
    "get_recipe",
    "Voir le détail complet d'une recette (ingrédients, étapes, temps)",
    {
      recipeId: z.string().describe("ID de la recette"),
    },
    async (params) => {
      try {
        const recipe = await client.get<Record<string, unknown>>(`/api/recipes/${params.recipeId}`);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(recipe, null, 2),
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

  // ─── Convertir recette → liste de courses ──────────────────
  server.tool(
    "recipe_to_shopping_list",
    "Convertir les ingrédients d'une recette en liste de courses. Crée automatiquement une liste avec tous les ingrédients.",
    {
      recipeId: z.string().describe("ID de la recette à convertir"),
    },
    async (params) => {
      try {
        const result = await client.post(`/api/recipes/${params.recipeId}/to-list`, {});

        return {
          content: [
            {
              type: "text" as const,
              text: `Liste de courses créée à partir de la recette !\n\n${JSON.stringify(result, null, 2)}`,
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
