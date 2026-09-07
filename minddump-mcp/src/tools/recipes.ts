import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerRecipeTools(server: McpServer) {
  // ─── Créer une recette ──────────────────────────────────────
  server.tool(
    "create_recipe",
    "Créer une nouvelle recette dans MindDump. Si une URL HelloFresh, Jow ou Quitoque est fournie, importe automatiquement avec photo, ingrédients et étapes enrichies. Sinon, crée manuellement.",
    {
      title: z.string().optional().describe("Nom de la recette (optionnel si URL fournie)"),
      url: z.string().optional().describe("URL d'une recette HelloFresh, Jow ou Quitoque — si fournie, importe automatiquement avec enrichissement complet"),
      description: z.string().optional().describe("Description courte de la recette"),
      servings: z.number().optional().default(4).describe("Nombre de portions"),
      prepTime: z.number().optional().describe("Temps de préparation en minutes"),
      cookTime: z.number().optional().describe("Temps de cuisson en minutes"),
      steps: z.array(z.string()).optional().describe("Liste des étapes de la recette (ignoré si URL HelloFresh)"),
      ingredients: z
        .array(
          z.object({
            name: z.string().describe("Nom de l'ingrédient"),
            quantity: z.string().describe("Quantité (ex: '200', '2', '1/2')"),
            unit: z.string().optional().describe("Unité (ex: 'g', 'ml', 'pièce', 'cuillère à soupe')"),
          })
        )
        .optional()
        .describe("Liste des ingrédients (ignoré si URL HelloFresh)"),
      groupId: z.string().optional().describe("ID du groupe pour partager la recette (optionnel)"),
      planned: z.boolean().optional().default(false).describe("Marquer comme recette planifiée"),
      inCatalog: z.boolean().optional().default(true).describe("Ajouter au catalogue de recettes"),
    },
    async (params) => {
      try {
        if (params.url && params.url.includes("hellofresh")) {
          const result = await client.post("/api/recipes/import-hellofresh", {
            url: params.url,
            servings: params.servings,
            groupId: params.groupId,
            planned: params.planned,
            inCatalog: params.inCatalog,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: `Recette HelloFresh importée et enrichie automatiquement !\n\n${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        }

        if (params.url && params.url.includes("quitoque")) {
          const result = await client.post("/api/recipes/import-quitoque", {
            url: params.url,
            servings: params.servings,
            groupId: params.groupId,
            planned: params.planned,
            inCatalog: params.inCatalog,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: `Recette Quitoque importée avec succès !\n\n${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        }

        if (params.url && /jow\.fr\/(en\/)?recipes\//.test(params.url)) {
          const result = await client.post("/api/recipes/import-jow", {
            url: params.url,
            servings: params.servings,
            groupId: params.groupId,
            planned: params.planned,
            inCatalog: params.inCatalog,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: `Recette Jow importée avec succès !\n\n${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        }

        if (!params.title) {
          return {
            content: [{ type: "text" as const, text: "Erreur: le titre est requis pour une recette manuelle (ou fournir une URL HelloFresh/Jow/Quitoque)" }],
            isError: true,
          };
        }

        const recipe = await client.post("/api/recipes", {
          title: params.title,
          description: params.description,
          servings: params.servings,
          prepTime: params.prepTime,
          cookTime: params.cookTime,
          steps: params.steps || [],
          ingredients: params.ingredients || [],
          groupId: params.groupId,
          planned: params.planned,
          inCatalog: params.inCatalog,
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
            const tags = [r.planned && "📅 prévue", r.inCatalog && "📖 catalogue"].filter(Boolean).join(" ");
            return `- **${r.title}** (id: ${r.id}) — ${r.servings} portions, ${ingredients} ingrédients${time ? `, ${time}` : ""}${tags ? ` [${tags}]` : ""}`;
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

  // ─── Chercher une recette HelloFresh ─────────────────────────
  server.tool(
    "search_hellofresh",
    "Chercher une recette sur HelloFresh par nom. Utilise cette commande pour trouver l'URL d'une recette avant de l'importer, par exemple quand l'utilisateur donne un nom de recette ou une photo de fiche HelloFresh.",
    {
      query: z.string().describe("Nom de la recette à chercher (ex: 'croque burger poulet')"),
      limit: z.number().optional().default(5).describe("Nombre de résultats max (1-20)"),
    },
    async (params) => {
      try {
        const results = await client.get<{ total: number; results: Array<{ id: string; name: string; headline: string; prepTime: string; imagePath: string | null; url: string }> }>("/api/recipes/search-hellofresh", {
          q: params.query,
          limit: String(params.limit),
        });

        if (!results.results?.length) {
          return {
            content: [{ type: "text" as const, text: `Aucune recette trouvée pour "${params.query}"` }],
          };
        }

        const list = results.results.map((r, i) =>
          `${i + 1}. **${r.name}** — ${r.headline || ""}\n   URL: ${r.url}`
        ).join("\n\n");

        return {
          content: [{
            type: "text" as const,
            text: `${results.total} résultat(s) pour "${params.query}" :\n\n${list}`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Erreur: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ─── Importer une recette HelloFresh ────────────────────────
  server.tool(
    "import_hellofresh",
    "Importer une recette depuis une URL HelloFresh. Récupère automatiquement le titre, les ingrédients, les étapes, les temps et les photos.",
    {
      url: z.string().describe("URL de la recette HelloFresh (ex: https://www.hellofresh.fr/recipes/...)"),
      servings: z.number().optional().default(4).describe("Nombre de portions souhaité"),
      groupId: z.string().optional().describe("ID du groupe pour partager la recette (optionnel)"),
      planned: z.boolean().optional().default(false).describe("Marquer comme recette planifiée"),
      inCatalog: z.boolean().optional().default(true).describe("Ajouter au catalogue"),
    },
    async (params) => {
      try {
        const result = await client.post("/api/recipes/import-hellofresh", {
          url: params.url,
          servings: params.servings,
          groupId: params.groupId,
          planned: params.planned,
          inCatalog: params.inCatalog,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Recette HelloFresh importée avec succès !\n\n${JSON.stringify(result, null, 2)}`,
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

  // ─── Importer une recette Jow ───────────────────────────────
  server.tool(
    "import_jow",
    "Importer une recette depuis une URL Jow. Récupère automatiquement le titre, les ingrédients, les étapes, les temps et la photo.",
    {
      url: z.string().describe("URL de la recette Jow (ex: https://jow.fr/recipes/crepes-maison-83jq25q5innb780q0wzk)"),
      servings: z.number().optional().default(4).describe("Nombre de portions souhaité"),
      groupId: z.string().optional().describe("ID du groupe pour partager la recette (optionnel)"),
      planned: z.boolean().optional().default(false).describe("Marquer comme recette planifiée"),
      inCatalog: z.boolean().optional().default(true).describe("Ajouter au catalogue"),
    },
    async (params) => {
      try {
        const result = await client.post("/api/recipes/import-jow", {
          url: params.url,
          servings: params.servings,
          groupId: params.groupId,
          planned: params.planned,
          inCatalog: params.inCatalog,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Recette Jow importée avec succès !\n\n${JSON.stringify(result, null, 2)}`,
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

  // ─── Chercher une recette Quitoque ─────────────────────────
  server.tool(
    "search_quitoque",
    "Chercher une recette sur Quitoque par nom. Utilise cette commande pour trouver l'URL d'une recette avant de l'importer.",
    {
      query: z.string().describe("Nom de la recette à chercher (ex: 'poulet tikka')"),
      limit: z.number().optional().default(5).describe("Nombre de résultats max (1-20)"),
    },
    async (params) => {
      try {
        const results = await client.get<{ total: number; results: Array<{ slug: string; title: string; url: string; image: string | null; duration: string | null }> }>("/api/recipes/search-quitoque", {
          q: params.query,
          limit: String(params.limit),
        });

        if (!results.results?.length) {
          return {
            content: [{ type: "text" as const, text: `Aucune recette Quitoque trouvée pour "${params.query}"` }],
          };
        }

        const list = results.results.map((r, i) =>
          `${i + 1}. **${r.title}**${r.duration ? ` — ${r.duration}` : ""}\n   URL: ${r.url}`
        ).join("\n\n");

        return {
          content: [{
            type: "text" as const,
            text: `${results.total} résultat(s) Quitoque pour "${params.query}" :\n\n${list}`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Erreur: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ─── Importer une recette Quitoque ──────────────────────────
  server.tool(
    "import_quitoque",
    "Importer une recette depuis une URL Quitoque. Récupère automatiquement le titre, les ingrédients, les étapes, les temps et la photo.",
    {
      url: z.string().describe("URL de la recette Quitoque (ex: https://www.quitoque.fr/recettes/poulet-tikka-masala)"),
      servings: z.number().optional().default(2).describe("Nombre de portions souhaité"),
      groupId: z.string().optional().describe("ID du groupe pour partager la recette (optionnel)"),
      planned: z.boolean().optional().default(false).describe("Marquer comme recette planifiée"),
      inCatalog: z.boolean().optional().default(true).describe("Ajouter au catalogue"),
    },
    async (params) => {
      try {
        const result = await client.post("/api/recipes/import-quitoque", {
          url: params.url,
          servings: params.servings,
          groupId: params.groupId,
          planned: params.planned,
          inCatalog: params.inCatalog,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Recette Quitoque importée avec succès !\n\n${JSON.stringify(result, null, 2)}`,
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

  // ─── Enrichir une recette avec HelloFresh ──────────────────
  server.tool(
    "enrich_recipe_hellofresh",
    "Enrichir une recette existante avec les données HelloFresh ou Jow (photo, ingrédients, étapes détaillées). Utile quand une recette a été créée manuellement.",
    {
      recipeId: z.string().describe("ID de la recette à enrichir"),
      url: z.string().describe("URL de la recette HelloFresh ou Jow correspondante"),
    },
    async (params) => {
      try {
        const result = await client.post(`/api/recipes/${params.recipeId}/enrich`, {
          url: params.url,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Recette enrichie avec les données HelloFresh !\n\n${JSON.stringify(result, null, 2)}`,
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
