/**
 * Semainier : types partagés et calculs purs (aucun accès base, importable côté
 * client). Les rubriques sont définies par la famille (KidTracker) ; une saisie
 * de jour est un objet { [idRubrique]: idsDesChoix | nombre }.
 */

export type KidTrackerKind = "single" | "multi" | "count";

export const KID_KINDS: readonly KidTrackerKind[] = ["single", "multi", "count"];

export interface KidOptionDto {
  id: string;
  label: string;
  icon: string;
  position: number;
  /** Faux = choix masqué : absent des éditeurs, mais ses anciennes saisies restent lisibles. */
  active: boolean;
}

export interface KidTrackerDto {
  id: string;
  profileId: string;
  label: string;
  icon: string;
  kind: KidTrackerKind;
  position: number;
  /** Faux = rubrique masquée (réversible) : absente partout, saisies conservées. */
  active: boolean;
  /** Vrai pour une rubrique reprise de l'ancien semainier tant que la famille ne l'a pas renommée. */
  needsRename: boolean;
  options: KidOptionDto[];
}

export type KidDayValues = Record<string, string[] | number>;

export interface KidDayDto {
  date: string;
  values: KidDayValues;
}

export const KID_LABEL_MAX = 30;
export const KID_COUNT_MAX = 99;
export const KID_MAX_ACTIVE_TRACKERS = 12;
export const KID_MAX_ACTIVE_OPTIONS = 16;
/** Plafonds au total, masqués compris : bornent la croissance de la configuration d'un enfant. */
export const KID_MAX_TRACKERS_TOTAL = 40;
export const KID_MAX_OPTIONS_TOTAL = 40;
export const KID_MAX_WEEK_DAYS = 31;

// RegExp(…) plutôt qu'un littéral : le drapeau « u » (propriétés Unicode) dépasse la cible de tsconfig.
const CONTROL_CHARS = new RegExp("[\\p{Cc}\\u2028\\u2029]", "gu");
const FORMAT_CHARS = new RegExp("\\p{Cf}", "gu");

/**
 * Retire les caractères invisibles d'un libellé : les caractères de contrôle (tabulation,
 * retour à la ligne…) et les séparateurs U+2028-2029 deviennent des espaces ; les caractères de format (Cf : trait d'union
 * conditionnel U+00AD, joints U+200B-200F, U+2060-2064, marque arabe U+061C, U+FEFF…) sont
 * supprimés. Règle unique du nettoyage des
 * libellés et de la comparaison (« Hu\u2060meur » doit valoir « Humeur »).
 */
export function stripInvisible(value: string): string {
  return value.replace(CONTROL_CHARS, " ").replace(FORMAT_CHARS, "");
}

/** Comparaison de libellés : sans casse, sans accents, sans caractères invisibles, espaces réduits. */
export function normalizeKidKey(value: string): string {
  return stripInvisible(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Vrai pour une date AAAA-MM-JJ qui existe au calendrier. */
export function isRealDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function toUtc(date: string): number {
  const m = DATE_RE.exec(date)!;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Nombre de jours de la période, bornes comprises. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000) + 1;
}

/** Toutes les dates de la période, bornes comprises. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = toUtc(from); t <= toUtc(to); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Date du jour (AAAA-MM-JJ) à Paris. */
export function todayInParis(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(now);
}

/** Saisies d'un jour restreintes aux rubriques données et débarrassées des valeurs vides. */
export function visibleValues(values: unknown, trackers: Pick<KidTrackerDto, "id" | "kind">[]): KidDayValues {
  const out: KidDayValues = {};
  if (!values || typeof values !== "object" || Array.isArray(values)) return out;
  const raw = values as Record<string, unknown>;
  for (const t of trackers) {
    const v = raw[t.id];
    if (t.kind === "count") {
      if (typeof v === "number" && Number.isFinite(v)) out[t.id] = v;
    } else if (Array.isArray(v)) {
      const ids = v.filter((x): x is string => typeof x === "string");
      if (ids.length > 0) out[t.id] = ids;
    }
  }
  return out;
}

/** { "Humeur": ["Content"], "Compteur": 3 } : saisies lisibles par une personne (export, assistant). */
export function describeValues(
  values: unknown,
  trackers: Pick<KidTrackerDto, "id" | "kind" | "label" | "options">[]
): Record<string, string[] | number> {
  const out: Record<string, string[] | number> = {};
  const seen = visibleValues(values, trackers);
  for (const t of trackers) {
    const v = seen[t.id];
    if (v === undefined) continue;
    out[t.label] = typeof v === "number" ? v : v.map((id) => t.options.find((o) => o.id === id)?.label ?? id);
  }
  return out;
}

export interface KidWeekSummary {
  from: string;
  to: string;
  /** Jours de la période déjà écoulés (aujourd'hui compris) : la base des « jours remplis ». */
  countedDays: number;
  /** Jours comptés où au moins une rubrique active est renseignée. */
  filledDays: number;
  trackers: Array<{
    trackerId: string;
    label: string;
    filledDays: number;
    /** Choix le plus fréquent (rubriques à choix), départagé par l'ordre des choix. */
    mostFrequent: { label: string; days: number } | null;
    /** Somme du compteur sur la période (rubriques compteur). */
    total: number | null;
  }>;
  /** Phrases prêtes à afficher ou à lire : constat seulement, aucune interprétation. */
  lines: string[];
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/**
 * Ligne de bilan d'une période. Ne compte que les jours remplis (une case vide n'est
 * pas un « non ») et reste descriptive : jamais d'alerte ni de jugement.
 */
export function summarizeWeek(
  trackers: KidTrackerDto[],
  days: KidDayDto[],
  range: { from: string; to: string; today: string }
): KidWeekSummary {
  const active = trackers.filter((t) => t.active);
  const lastCounted = range.today < range.to ? range.today : range.to;
  const countedDays = range.from > lastCounted ? 0 : daysBetween(range.from, lastCounted);
  const counted = days.filter((d) => d.date >= range.from && d.date <= lastCounted);

  const perTracker = active.map((t) => {
    const tally = new Map<string, number>();
    let filled = 0;
    let total = 0;
    for (const d of counted) {
      const v = d.values[t.id];
      if (v === undefined) continue;
      filled++;
      if (typeof v === "number") total += v;
      else for (const id of Array.from(new Set(v))) tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    let mostFrequent: { label: string; days: number } | null = null;
    if (t.kind !== "count") {
      for (const o of [...t.options].sort((a, b) => a.position - b.position)) {
        const n = tally.get(o.id) ?? 0;
        if (n > 0 && (!mostFrequent || n > mostFrequent.days)) mostFrequent = { label: o.label, days: n };
      }
    }
    return {
      trackerId: t.id,
      label: t.label,
      filledDays: filled,
      mostFrequent,
      total: t.kind === "count" && filled > 0 ? total : null,
    };
  });

  const filledDays = counted.filter((d) => active.some((t) => d.values[t.id] !== undefined)).length;

  const lines: string[] = [];
  if (countedDays > 0) {
    lines.push(`${filledDays} ${plural(filledDays, "jour rempli", "jours remplis")} sur ${countedDays}`);
  }
  for (const s of perTracker) {
    if (s.mostFrequent) {
      lines.push(`${s.label}, le plus fréquent : ${s.mostFrequent.label} (${s.mostFrequent.days} ${plural(s.mostFrequent.days, "jour", "jours")})`);
    } else if (s.total !== null) {
      lines.push(`${s.label} : ${s.total} sur ${s.filledDays} ${plural(s.filledDays, "jour rempli", "jours remplis")}`);
    }
  }

  return { from: range.from, to: range.to, countedDays, filledDays, trackers: perTracker, lines };
}
