import type { Todo } from "@prisma/client";
import { prisma } from "./prisma";
import { occurrencesBetween } from "./recurrence";
import { assigneesInclude, withAssigneeIds } from "./profiles";

/**
 * Tâche récurrente cochée : crée l'occurrence suivante, à la prochaine
 * échéance à venir (une tâche en retard ne recrée pas les échéances passées),
 * pour les mêmes personnes. Sans récurrence ni échéance : rien.
 */
export async function createNextOccurrence(existing: Todo, assigneeIds: string[]) {
  if (!existing.recurrence || !existing.dueDate) return null;
  const from = new Date(Math.max(existing.dueDate.getTime() + 1, Date.now()));
  const to = new Date(from.getTime() + 400 * 86400000);
  const nextDue = occurrencesBetween(existing.dueDate, null, existing.recurrence, from, to)[0]?.date;
  if (!nextDue) return null;

  const created = await prisma.todo.create({
    data: {
      title: existing.title,
      description: existing.description,
      priority: existing.priority,
      dueDate: nextDue,
      recurrence: existing.recurrence,
      notifyBefore: existing.notifyBefore,
      position: existing.position,
      userId: existing.userId,
      groupId: existing.groupId,
      // L'occurrence suivante revient aux mêmes personnes.
      assignees: { create: assigneeIds.map((profileId) => ({ profileId })) },
    },
    include: assigneesInclude,
  });
  return withAssigneeIds(created);
}
