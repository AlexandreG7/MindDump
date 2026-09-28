import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_LABELS: Record<string, string> = { lunch: "midi", dinner: "soir" };

type Meal = {
  id: string;
  date: string;
  slot: string;
  note: string | null;
  servings: number | null;
  recipe: { id: string; title: string } | null;
};

function formatMeal(m: Meal): string {
  const day = new Date(`${m.date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const what = m.recipe ? `**${m.recipe.title}** (recette ${m.recipe.id})` : `_${m.note}_`;
  const servings = m.servings ? ` · ${m.servings} pers.` : "";
  return `- ${day} ${SLOT_LABELS[m.slot] ?? m.slot} — ${what}${servings} (id: ${m.id})`;
}

function errorResult(error: unknown) {
  return { content: [{ type: "text" as const, text: `Erreur: ${(error as Error).message}` }], isError: true };
}

/** Lundi et dimanche de la semaine d'une date (AAAA-MM-JJ). */
function weekOf(date: string): { from: string; to: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

export function registerMealTools(server: McpServer) {
  server.tool(
    "plan_meal",
    "Prévoir un repas un jour donné, midi ou soir : une recette MindDump (recipeId, voir list_recipes) ou une simple note " +
      "(« restes », « resto »). Visible dans l'onglet Semaine des recettes et sur l'écran mural du foyer.",
    {
      date: z.string().regex(DAY).describe("Jour, AAAA-MM-JJ"),
      slot: z.enum(["lunch", "dinner"]).describe("lunch = midi, dinner = soir"),
      recipeId: z.string().optional().describe("Recette à cuisiner"),
      note: z.string().optional().describe("À la place d'une recette : restes, resto, pique-nique…"),
      servings: z.number().int().positive().max(50).optional().describe("Portions prévues (ajuste les quantités des courses)"),
      groupId: z.string().optional().describe("Groupe (voir list_groups). Par défaut : le groupe principal"),
    },
    async (params) => {
      try {
        const meal = await client.post<Meal>("/api/meals", params);
        return { content: [{ type: "text" as const, text: `Repas prévu :\n${formatMeal(meal)}` }] };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "get_meal_plan",
    "Lister les repas prévus d'une semaine (celle d'aujourd'hui par défaut), midi et soir.",
    {
      date: z.string().regex(DAY).optional().describe("Un jour de la semaine voulue, AAAA-MM-JJ"),
      groupId: z.string().optional().describe("Limiter à un groupe"),
    },
    async (params) => {
      try {
        const { from, to } = weekOf(params.date ?? new Date().toISOString().slice(0, 10));
        const meals = await client.get<Meal[]>("/api/meals", { from, to, groupId: params.groupId });
        const text = meals.length
          ? `${meals.length} repas prévu(s) du ${from} au ${to} :\n\n${meals.map(formatMeal).join("\n")}`
          : `Aucun repas prévu du ${from} au ${to}.`;
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "meal_plan_to_shopping_list",
    "Créer une liste de courses avec les ingrédients de tous les repas prévus d'une semaine (regroupés et additionnés).",
    {
      date: z.string().regex(DAY).optional().describe("Un jour de la semaine voulue, AAAA-MM-JJ (aujourd'hui par défaut)"),
      groupId: z.string().optional().describe("Groupe"),
      listId: z.string().optional().describe("Ajouter à une liste existante plutôt qu'en créer une"),
    },
    async (params) => {
      try {
        const { from, to } = weekOf(params.date ?? new Date().toISOString().slice(0, 10));
        const res = await client.post<{ listId: string; added: number; meals: number }>("/api/meals/to-list", {
          from,
          to,
          groupId: params.groupId,
          listId: params.listId,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `${res.added} ingrédient(s) ajouté(s) pour ${res.meals} repas (liste ${res.listId}).`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
