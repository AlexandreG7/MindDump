import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client, ApiError } from "../client.js";

/**
 * Semainier : rubriques choisies par la famille pour chaque enfant (humeur, activités…).
 * Les routes /api/kids/trackers, /week et /day contrôlent l'accès (même foyer que l'app).
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NO_HEALTH = "Ne saisis pas d'informations de santé (voir les CGU).";

type Option = { id: string; label: string; icon: string; position: number; active: boolean };
type Tracker = {
  id: string;
  profileId: string;
  label: string;
  icon: string;
  kind: "single" | "multi" | "count";
  position: number;
  active: boolean;
  needsRename: boolean;
  options: Option[];
};
type WeekResponse = {
  trackers: Tracker[];
  days: Array<{ date: string; values: Record<string, string[] | number> }>;
  summary: {
    from: string;
    to: string;
    countedDays: number;
    filledDays: number;
    trackers: unknown;
    lines: string[];
  };
};
type ChildProfile = { id: string; name: string; kind: string; groupName?: string };

const KIND_LABELS = { single: "un seul choix", multi: "plusieurs choix", count: "compteur 0 à 99" };

function errorResult(error: unknown) {
  if (error instanceof ApiError) {
    let text = `Erreur: ${error.message}`;
    if (error.code) text += `\nCode: ${error.code}`;
    return { content: [{ type: "text" as const, text }], isError: true };
  }
  return { content: [{ type: "text" as const, text: `Erreur: ${(error as Error).message}` }], isError: true };
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Minuscules sans accents, pour comparer des noms. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Aujourd'hui à Paris, AAAA-MM-JJ. */
function todayParis(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
}

/** Lundi et dimanche de la semaine d'une date. */
function weekOf(date: string): { from: string; to: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

/** Retrouve un enfant par id ou par prénom (sans tenir compte de la casse ni des accents). */
async function resolveChild(child: string): Promise<{ profile: ChildProfile } | { error: string }> {
  const kids = await client.get<ChildProfile[]>("/api/profiles", { kind: "child" });
  if (!kids.length) return { error: "Aucun enfant dans ton foyer." };
  const byId = kids.find((k) => k.id === child);
  if (byId) return { profile: byId };
  const matches = kids.filter((k) => norm(k.name) === norm(child));
  if (matches.length === 1) return { profile: matches[0] };
  if (matches.length > 1) {
    return {
      error:
        `Plusieurs enfants s'appellent « ${child} » : ` +
        matches.map((k) => `${k.name} (groupe ${k.groupName ?? "?"}, id ${k.id})`).join(" ; ") +
        ". Réessaie avec l'id.",
    };
  }
  return { error: `Enfant « ${child} » introuvable. Enfants connus : ${kids.map((k) => k.name).join(", ")}.` };
}

function formatTracker(t: Tracker): string {
  const flags = [KIND_LABELS[t.kind], t.active ? null : "masquée", t.needsRename ? "à renommer" : null].filter(Boolean);
  const head = `- **${t.label}** (${flags.join(", ")})`;
  if (t.kind === "count") return head;
  const opts = t.options.filter((o) => o.active).map((o) => o.label);
  return `${head} : ${opts.length ? opts.join(", ") : "aucun choix"}`;
}

function formatDayValue(t: Tracker, v: string[] | number | undefined): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return String(v);
  if (!v.length) return null;
  const byId = new Map(t.options.map((o) => [o.id, o.label]));
  return v.map((id) => byId.get(id) ?? id).join(" + ");
}

function frDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function registerKidTools(server: McpServer) {
  const childParam = z.string().min(1).describe("Prénom de l'enfant (voir list_groups) ou son profileId");

  server.tool(
    "kids_list_trackers",
    "Lister les rubriques du semainier d'un enfant (celles que la famille a choisies : humeur, activités, repas…) " +
      "avec leurs choix possibles. À appeler avant kids_fill_day pour connaître les libellés exacts. " +
      NO_HEALTH,
    {
      child: childParam,
      includeHidden: z.boolean().optional().describe("Inclure aussi les rubriques et choix masqués (faux par défaut)"),
    },
    async ({ child, includeHidden }) => {
      try {
        const r = await resolveChild(child);
        if ("error" in r) return errorResult(new Error(r.error));
        const trackers = await client.get<Tracker[]>("/api/kids/trackers", {
          profileId: r.profile.id,
          all: includeHidden ? "1" : undefined,
        });
        const shown = includeHidden ? trackers : trackers.filter((t) => t.active);
        if (!shown.length) return ok(`${r.profile.name} n'a aucune rubrique dans son semainier. Elles se créent dans l'app.`);
        return ok(
          `Rubriques du semainier de ${r.profile.name} (id ${r.profile.id}) :\n\n${shown
            .sort((a, b) => a.position - b.position)
            .map(formatTracker)
            .join("\n")}`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "kids_read_week",
    "Lire le semainier d'un enfant sur une semaine (lundi au dimanche) : ce qui a été saisi chaque jour, avec les libellés, " +
      "et le bilan de la semaine. Semaine en cours par défaut (fuseau Europe/Paris). " +
      NO_HEALTH,
    {
      child: childParam,
      date: z.string().regex(DAY).optional().describe("Un jour de la semaine voulue, AAAA-MM-JJ (cette semaine par défaut)"),
    },
    async ({ child, date }) => {
      try {
        const r = await resolveChild(child);
        if ("error" in r) return errorResult(new Error(r.error));
        const { from, to } = weekOf(date ?? todayParis());
        const week = await client.get<WeekResponse>("/api/kids/week", { profileId: r.profile.id, from, to });
        const trackers = [...week.trackers].sort((a, b) => a.position - b.position);

        const days = week.days
          .map((d) => {
            const lines = trackers
              .map((t) => {
                const txt = formatDayValue(t, d.values[t.id]);
                return txt ? `  - ${t.label} : ${txt}` : null;
              })
              .filter(Boolean);
            return `**${frDate(d.date)}** (${d.date})\n${lines.length ? lines.join("\n") : "  - rien de saisi"}`;
          })
          .join("\n");

        const bilan = week.summary.lines.length ? `\n\nBilan :\n${week.summary.lines.map((l) => `- ${l}`).join("\n")}` : "";
        return ok(
          `Semainier de ${r.profile.name} du ${from} au ${to} ` +
            `(${week.summary.filledDays} jour(s) rempli(s) sur ${week.summary.countedDays}) :\n\n${days}${bilan}`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "kids_fill_day",
    "Remplir une journée du semainier d'un enfant avec les libellés des rubriques et des choix, " +
      "ex. { \"Humeur\": \"content\", \"Activités\": [\"peinture\", \"vélo\"], \"Verres d'eau\": 4 }. " +
      "Les rubriques non citées ne sont pas modifiées ; null efface une rubrique. Libellés sans tenir compte de la casse " +
      "ni des accents. Si un libellé est inconnu, l'erreur donne la liste des valeurs acceptées : corrige et réessaie. " +
      "Appelle kids_list_trackers pour connaître les rubriques. " +
      NO_HEALTH,
    {
      child: childParam,
      date: z.string().regex(DAY).optional().describe("Jour, AAAA-MM-JJ (aujourd'hui, fuseau Europe/Paris, par défaut)"),
      values: z
        .record(z.union([z.string(), z.number().int().min(0).max(99), z.array(z.string()), z.null()]))
        .describe(
          "Rubrique (libellé) → choix : un libellé, une liste de libellés (plusieurs choix), un entier 0 à 99 (compteur) ou null (effacer)"
        ),
    },
    async ({ child, date, values }) => {
      try {
        if (!Object.keys(values).length) return errorResult(new Error("Aucune rubrique à remplir."));
        const r = await resolveChild(child);
        if ("error" in r) return errorResult(new Error(r.error));
        const day = date ?? todayParis();
        const res = await client.patch<{ date: string; values: Record<string, string[] | number>; updatedAt: string }>(
          "/api/kids/day",
          { profileId: r.profile.id, date: day, values }
        );
        // Relit les libellés pour confirmer ce qui est enregistré.
        const trackers = await client.get<Tracker[]>("/api/kids/trackers", { profileId: r.profile.id, all: "1" });
        const lines = trackers
          .sort((a, b) => a.position - b.position)
          .map((t) => {
            const txt = formatDayValue(t, res.values[t.id]);
            return txt ? `- ${t.label} : ${txt}` : null;
          })
          .filter(Boolean);
        return ok(`Journée du ${frDate(day)} de ${r.profile.name} enregistrée :\n${lines.join("\n") || "- (vide)"}`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
