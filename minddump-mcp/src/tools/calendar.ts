import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

const TIME_ZONE = "Europe/Paris";

const RECURRENCES = ["daily", "weekly", "biweekly", "monthly", "yearly"] as const;

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "tous les jours",
  weekly: "toutes les semaines",
  biweekly: "toutes les 2 semaines",
  monthly: "tous les mois",
  yearly: "tous les ans",
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  endDate?: string | null;
  allDay: boolean;
  recurrence?: string | null;
  notifyBefore?: number | null;
  groupId?: string | null;
  source?: string;
};

/**
 * Une journée entière se transmet comme le fait l'app web (minuit, heure du
 * serveur) ; une date ISO complète est transmise telle quelle.
 */
function toApiDate(value: string, allDay: boolean): string {
  if (DATE_ONLY.test(value)) return `${value}T00:00:00`;
  return allDay ? `${value.slice(0, 10)}T00:00:00` : value;
}

function formatEvent(e: CalendarEvent): string {
  const date = new Date(e.date);
  const day = date.toLocaleDateString("fr-FR", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = e.allDay
    ? "journée"
    : date.toLocaleTimeString("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const extras = [
    e.recurrence && RECURRENCE_LABELS[e.recurrence],
    e.notifyBefore ? `rappel ${e.notifyBefore} min avant` : null,
    e.source ? `calendrier « ${e.source} »` : null,
  ].filter(Boolean);
  const id = e.source ? "" : ` (id: ${e.id.split("_")[0]})`;
  return `- ${day} ${time} — **${e.title}**${id}${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
}

function errorResult(error: unknown) {
  return {
    content: [{ type: "text" as const, text: `Erreur: ${(error as Error).message}` }],
    isError: true,
  };
}

export function registerCalendarTools(server: McpServer) {
  // ─── Créer un événement ────────────────────────────────────
  server.tool(
    "create_event",
    "Ajouter un rendez-vous ou un événement au calendrier MindDump (pédiatre, réunion parents-profs, contrôle technique...). " +
      "Un événement rattaché à un groupe est visible par tous ses membres, et son rappel e-mail part à chacun d'eux. " +
      "Pour une échéance qui revient chaque année (assurance, vaccin, impôts), utiliser recurrence: \"yearly\".",
    {
      title: z.string().describe("Titre de l'événement (ex: « Pédiatre — Léo »)"),
      date: z
        .string()
        .describe(
          "Début. Journée entière : AAAA-MM-JJ. Avec heure : ISO 8601 avec fuseau (ex: 2026-10-01T15:00:00+02:00, heure de Paris)"
        ),
      endDate: z.string().optional().describe("Fin, même format que date (optionnel)"),
      allDay: z
        .boolean()
        .optional()
        .describe("Journée entière. Déduit automatiquement si date est au format AAAA-MM-JJ"),
      description: z.string().optional().describe("Notes (adresse, documents à apporter...)"),
      recurrence: z.enum(RECURRENCES).optional().describe("Répétition de l'événement"),
      notifyBefore: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Rappel e-mail X minutes avant (1 jour = 1440, 1 semaine = 10080, 30 jours = 43200)"),
      color: z.string().optional().describe("Couleur hexadécimale (ex: #ef4444)"),
      groupId: z
        .string()
        .optional()
        .describe("Groupe avec qui partager l'événement (voir list_groups). Par défaut : le groupe principal"),
    },
    async (params) => {
      try {
        const allDay = params.allDay ?? DATE_ONLY.test(params.date);
        const event = await client.post<CalendarEvent>("/api/calendar", {
          title: params.title,
          description: params.description,
          date: toApiDate(params.date, allDay),
          endDate: params.endDate ? toApiDate(params.endDate, allDay) : undefined,
          allDay,
          recurrence: params.recurrence,
          notifyBefore: params.notifyBefore,
          color: params.color,
          groupId: params.groupId,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Événement ajouté au calendrier :\n${formatEvent(event)}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── Lister les événements d'un mois ───────────────────────
  server.tool(
    "list_events",
    "Lister les événements du calendrier pour un mois donné (le mois courant par défaut), occurrences récurrentes comprises. " +
      "Inclut par défaut les calendriers externes auxquels le foyer est abonné (école, club...).",
    {
      month: z.number().int().min(1).max(12).optional().describe("Mois (1-12), mois courant par défaut"),
      year: z.number().int().optional().describe("Année, année courante par défaut"),
      groupId: z.string().optional().describe("Limiter à un groupe (optionnel)"),
      includeSubscriptions: z
        .boolean()
        .optional()
        .default(true)
        .describe("Inclure les calendriers externes abonnés (lecture seule)"),
    },
    async (params) => {
      try {
        const now = new Date();
        const month = params.month ?? now.getMonth() + 1;
        const year = params.year ?? now.getFullYear();

        const events = await client.get<CalendarEvent[]>("/api/calendar", {
          month: String(month),
          year: String(year),
          groupId: params.groupId,
        });

        const all: CalendarEvent[] = [...events];
        const warnings: string[] = [];

        if (params.includeSubscriptions) {
          const rangeStart = new Date(year, month - 1, 1).getTime() - 86400000;
          const rangeEnd = new Date(year, month, 1).getTime() + 86400000;
          const subs = await client.get<Array<{ id: string; name: string; enabled: boolean }>>(
            "/api/calendar/subscriptions",
            { groupId: params.groupId }
          );
          for (const sub of subs.filter((s) => s.enabled)) {
            try {
              const data = await client.get<{ events: CalendarEvent[] }>(
                `/api/calendar/subscriptions/${sub.id}`
              );
              for (const e of data.events) {
                const t = new Date(e.date).getTime();
                if (t >= rangeStart && t < rangeEnd) all.push({ ...e, source: sub.name });
              }
            } catch {
              warnings.push(`Calendrier « ${sub.name} » injoignable pour le moment.`);
            }
          }
        }

        all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const label = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        });
        const body =
          all.length === 0
            ? `Aucun événement en ${label}.`
            : `${all.length} événement(s) en ${label} :\n\n${all.map(formatEvent).join("\n")}`;

        return {
          content: [
            {
              type: "text" as const,
              text: warnings.length ? `${body}\n\n${warnings.join("\n")}` : body,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── Modifier un événement ─────────────────────────────────
  server.tool(
    "update_event",
    "Modifier un événement du calendrier (déplacer, renommer, changer le rappel ou la récurrence). " +
      "Sur un événement récurrent, la modification s'applique à toute la série.",
    {
      eventId: z.string().describe("ID de l'événement (donné par list_events)"),
      title: z.string().optional().describe("Nouveau titre"),
      description: z.string().optional().describe("Nouvelles notes"),
      date: z.string().optional().describe("Nouveau début (AAAA-MM-JJ ou ISO 8601 avec fuseau)"),
      endDate: z.string().optional().describe("Nouvelle fin"),
      allDay: z.boolean().optional().describe("Journée entière"),
      recurrence: z
        .enum([...RECURRENCES, "none"])
        .optional()
        .describe("Nouvelle répétition, ou \"none\" pour la retirer"),
      notifyBefore: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Rappel e-mail X minutes avant (0 pour le retirer)"),
    },
    async (params) => {
      try {
        const { eventId, ...updates } = params;
        const allDay = updates.allDay ?? (updates.date ? DATE_ONLY.test(updates.date) : undefined);
        const body: Record<string, unknown> = { ...updates };
        if (allDay !== undefined) body.allDay = allDay;
        if (updates.date) body.date = toApiDate(updates.date, allDay ?? false);
        if (updates.endDate) body.endDate = toApiDate(updates.endDate, allDay ?? false);
        if (updates.notifyBefore === 0) body.notifyBefore = null;

        const id = eventId.split("_")[0];
        await client.patch(`/api/calendar/${id}`, body);

        return {
          content: [{ type: "text" as const, text: `Événement ${id} mis à jour.` }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── Supprimer un événement ────────────────────────────────
  server.tool(
    "delete_event",
    "Supprimer un événement du calendrier. Sur un événement récurrent, toute la série est supprimée : confirmer avec l'utilisateur avant.",
    {
      eventId: z.string().describe("ID de l'événement (donné par list_events)"),
    },
    async (params) => {
      try {
        const id = params.eventId.split("_")[0];
        await client.delete(`/api/calendar/${id}`);
        return {
          content: [{ type: "text" as const, text: `Événement ${id} supprimé.` }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
