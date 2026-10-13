/**
 * Reprise de l'ancien semainier (colonnes fixes de KidDayEntry : weather, mood, nap,
 * accident, activities) vers les rubriques choisies par la famille (KidTracker).
 * Source unique des rubriques reprises et de la conversion d'une ligne, utilisée par
 * prisma/backfill-kid-trackers.js (démarrage) et par src/lib/kidTrackers.ts
 * (lecture tolérante). Supprimé avec les anciennes colonnes au contract.
 */

/**
 * @typedef {"weather" | "mood" | "activities" | "nap" | "accident"} LegacyKey
 * @typedef {{
 *   key: LegacyKey,
 *   label: string,
 *   icon: string,
 *   kind: "single" | "multi",
 *   options: Array<[string, string, string]>,
 *   hideIfEmpty?: boolean,
 *   needsRename?: boolean,
 * }} LegacySpec
 */

/**
 * Ordre = ordre d'affichage de l'ancien semainier. Options : [valeur d'origine, libellé, image].
 * `hideIfEmpty` : créée masquée si l'enfant n'a aucune saisie dedans. `needsRename` :
 * libellé neutre à faire renommer par la famille.
 * @type {LegacySpec[]}
 */
const LEGACY_SPECS = [
  {
    key: "weather", label: "Météo", icon: "sun", kind: "single",
    options: [
      ["sunny", "Soleil", "sun"], ["partly-cloudy", "Éclaircies", "sun-cloud"], ["cloudy", "Nuages", "cloud"],
      ["rainy", "Pluie", "rain"], ["stormy", "Orage", "storm"], ["snowy", "Neige", "snow"],
    ],
  },
  {
    key: "mood", label: "Humeur", icon: "face-happy", kind: "single",
    options: [
      ["very-happy", "Très content", "face-very-happy"], ["happy", "Content", "face-happy"],
      ["neutral", "Bof", "face-neutral"], ["sad", "Triste", "face-sad"], ["angry", "Fâché", "face-angry"],
    ],
  },
  {
    key: "accident", label: "Goutte", icon: "drop", kind: "single", hideIfEmpty: true, needsRename: true,
    options: [["true", "Oui", "drop"], ["false", "Non", "sun"]],
  },
  {
    key: "nap", label: "Lune", icon: "moon", kind: "single", hideIfEmpty: true, needsRename: true,
    options: [["true", "Oui", "moon"], ["false", "Non", "sun"]],
  },
  {
    key: "activities", label: "Activités", icon: "star", kind: "multi",
    options: [
      ["painting", "Peinture", "brush"], ["reading", "Lecture", "book"], ["sport", "Sport", "ball"],
      ["music", "Musique", "music"], ["puzzle", "Puzzle", "puzzle"], ["park", "Parc", "tree"],
      ["cooking", "Cuisine", "pan"], ["swimming", "Piscine", "wave"], ["friends", "Copains", "people"],
      ["crafts", "Bricolage", "scissors"], ["animals", "Animaux", "paw"], ["dressup", "Déguisement", "mask"],
    ],
  },
];

/**
 * Anciennes colonnes d'une ligne → saisies par rubrique { idRubrique: [idsDeChoix] }.
 * `index` : pour chaque clé d'origine, l'id de la rubrique et ses choix par valeur d'origine.
 * Une valeur qui n'a pas de choix correspondant est comptée dans `unmapped` (jamais inventée).
 * @param {{weather: string|null, mood: string|null, nap: boolean|null, accident: boolean|null, activities: string|null}} row
 * @param {Map<string, {trackerId: string, options: Map<string, string>}>} index
 * @returns {{values: Record<string, string[]>, unmapped: number}}
 */
function legacyToValues(row, index) {
  /** @type {Record<string, string[]>} */
  const values = {};
  let unmapped = 0;
  /** @param {string} key @param {string[]} raw */
  const put = (key, raw) => {
    const target = index.get(key);
    if (!target) return;
    /** @type {string[]} */
    const ids = [];
    for (const v of raw) {
      const id = target.options.get(v);
      if (id) {
        if (!ids.includes(id)) ids.push(id);
      } else unmapped++;
    }
    if (ids.length > 0) values[target.trackerId] = ids;
  };
  if (typeof row.weather === "string" && row.weather) put("weather", [row.weather]);
  if (typeof row.mood === "string" && row.mood) put("mood", [row.mood]);
  if (typeof row.nap === "boolean") put("nap", [String(row.nap)]);
  if (typeof row.accident === "boolean") put("accident", [String(row.accident)]);
  let acts = [];
  try {
    acts = JSON.parse(row.activities || "[]");
  } catch {
    acts = [];
  }
  if (Array.isArray(acts)) put("activities", acts.filter((a) => typeof a === "string"));
  return { values, unmapped };
}

module.exports = { LEGACY_SPECS, legacyToValues };
