import { z } from "zod";
import { client } from "../client.js";

/** Paramètre commun : personnes du foyer concernées par un élément. */
export const assigneeIdsParam = z
  .array(z.string())
  .optional()
  .describe(
    "Personnes du foyer concernées (profileId donnés par list_groups, du même groupe que l'élément). " +
      "Ex : l'enfant pour un rendez-vous pédiatre. Les rappels vont alors aux personnes assignées qui ont un compte"
  );

/** Nom de chaque personne du foyer, par profileId (vide si l'API ne répond pas). */
export async function profileNames(): Promise<Map<string, string>> {
  try {
    const profiles = await client.get<Array<{ id: string; name: string }>>("/api/profiles");
    return new Map(profiles.map((p) => [p.id, p.name]));
  } catch {
    return new Map();
  }
}

/** « pour Léa, Tom », ou null sans personne assignée. */
export function forWhom(ids: string[] | undefined, names: Map<string, string>): string | null {
  const people = (ids ?? []).map((id) => names.get(id)).filter(Boolean);
  return people.length ? `pour ${people.join(", ")}` : null;
}
