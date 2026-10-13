/**
 * Bibliothèque d'images neutres du Semainier (40 icônes).
 *
 * Origine et licence : dessin maison, tracés SVG écrits pour MindDump
 * (aucune icône reprise de Lucide, Phosphor, Tabler ou autre pack ; aucune
 * dépendance ajoutée). Le projet en reste propriétaire.
 *
 * Principe : l'app ne fournit que des images sans signification propre ; le
 * parent leur donne un sens avec son propre libellé. Les identifiants et les
 * libellés d'accessibilité restent donc purement descriptifs (« goutte »,
 * « lune »). Aucune image médicale ou corporelle.
 *
 * Style : aplats francs, contour encre de 3 unités sur une grille de 64,
 * lisible de 24 px à 96 px. Les couleurs passent par des variables CSS
 * (`--ki-*`) avec des valeurs de repli, ce qui permet le thème sombre
 * (voir `.dark` dans globals.css).
 *
 * Les identifiants sont figés avec le lot L1 (`src/lib/kidIconIds.ts`). Une fois
 * les deux lots fusionnés, ce fichier pourra importer la liste depuis la lib.
 */
import React from "react";

export const KID_ICON_IDS = [
  "sun", "sun-cloud", "cloud", "rain", "storm", "snow", "moon", "star", "rainbow",
  "drop", "leaf", "flower", "tree",
  "face-very-happy", "face-happy", "face-neutral", "face-sad", "face-angry",
  "brush", "book", "ball", "music", "puzzle", "pan", "wave", "people", "scissors",
  "paw", "mask", "bike", "car", "house", "backpack", "cake", "heart", "cup",
  "check", "cross", "bell", "gift",
] as const;

export type KidIconId = (typeof KID_ICON_IDS)[number];

export type KidIconCategory = "meteo" | "humeur" | "activite" | "objet" | "nature" | "symbole";

export const KID_ICON_CATEGORY_LABELS: Record<KidIconCategory, string> = {
  meteo: "Météo",
  humeur: "Visages",
  activite: "Activités",
  objet: "Objets",
  nature: "Nature",
  symbole: "Symboles",
};

export const KID_ICON_LABELS: Record<KidIconId, string> = {
  sun: "soleil",
  "sun-cloud": "soleil et nuage",
  cloud: "nuage",
  rain: "nuage et gouttes",
  storm: "nuage et éclair",
  snow: "nuage et flocons",
  moon: "lune",
  star: "étoile",
  rainbow: "arc-en-ciel",
  drop: "goutte",
  leaf: "feuille",
  flower: "fleur",
  tree: "arbre",
  "face-very-happy": "visage très souriant",
  "face-happy": "visage souriant",
  "face-neutral": "visage neutre",
  "face-sad": "visage triste",
  "face-angry": "visage fâché",
  brush: "pinceau",
  book: "livre ouvert",
  ball: "ballon",
  music: "notes de musique",
  puzzle: "pièce de puzzle",
  pan: "poêle",
  wave: "vagues",
  people: "deux personnes",
  scissors: "ciseaux",
  paw: "empreinte de patte",
  mask: "masque de carnaval",
  bike: "vélo",
  car: "voiture",
  house: "maison",
  backpack: "sac à dos",
  cake: "gâteau",
  heart: "cœur",
  cup: "tasse",
  check: "coche",
  cross: "croix",
  bell: "cloche",
  gift: "cadeau",
};

export const KID_ICON_CATEGORIES: Record<KidIconId, KidIconCategory> = {
  sun: "meteo", "sun-cloud": "meteo", cloud: "meteo", rain: "meteo", storm: "meteo",
  snow: "meteo", moon: "meteo", rainbow: "meteo",
  drop: "nature", leaf: "nature", flower: "nature", tree: "nature", paw: "nature",
  "face-very-happy": "humeur", "face-happy": "humeur", "face-neutral": "humeur",
  "face-sad": "humeur", "face-angry": "humeur",
  brush: "activite", book: "activite", ball: "activite", music: "activite",
  puzzle: "activite", pan: "activite", wave: "activite", people: "activite",
  scissors: "activite", mask: "activite", bike: "activite",
  car: "objet", house: "objet", backpack: "objet", cake: "objet", cup: "objet",
  bell: "objet", gift: "objet",
  star: "symbole", heart: "symbole", check: "symbole", cross: "symbole",
};

export function isKidIconId(value: unknown): value is KidIconId {
  return typeof value === "string" && (KID_ICON_IDS as readonly string[]).includes(value);
}

// ─── Palette (variables CSS + repli) ─────────────────────

const INK = "var(--ki-ink, #2D2A3E)";
const PAPER = "var(--ki-paper, #FFFFFF)";
const C = {
  yellow: "var(--ki-yellow, #FFC83D)",
  orange: "var(--ki-orange, #FF9A3C)",
  red: "var(--ki-red, #F25F5C)",
  pink: "var(--ki-pink, #FF8FB1)",
  blue: "var(--ki-blue, #4DA3FF)",
  sky: "var(--ki-sky, #A9D8FF)",
  green: "var(--ki-green, #4CC38A)",
  violet: "var(--ki-violet, #8E7CFF)",
  brown: "var(--ki-brown, #B07A52)",
  grey: "var(--ki-grey, #C9D1DB)",
  slate: "var(--ki-slate, #8A94A6)",
};

const SW = 3; // épaisseur du contour

const outline = {
  stroke: INK,
  strokeWidth: SW,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

/** Formes pleines avec contour commun (l'union des formes est cernée une seule fois). */
function Blob({ fill, children }: { fill: string; children: React.ReactNode }) {
  return (
    <>
      <g fill={INK} stroke={INK} strokeWidth={SW * 2} strokeLinejoin="round">{children}</g>
      <g fill={fill} stroke="none">{children}</g>
    </>
  );
}

/** Trait coloré cerné d'encre. */
function Line({ d, color, w = 4 }: { d: string; color: string; w?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + SW * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function starPoints(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

const CLOUD_D = "M18 46A8 8 0 0 1 18 30A11 11 0 0 1 39 27A9.5 9.5 0 0 1 46 46Z";

function CloudShape({ fill = PAPER, x = 3, y = 4, s = 1 }: { fill?: string; x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={CLOUD_D} fill={fill} {...outline} />
    </g>
  );
}

function Face({ fill = C.yellow, children }: { fill?: string; children: React.ReactNode }) {
  return (
    <>
      <circle cx="32" cy="32" r="23" fill={fill} {...outline} />
      {children}
    </>
  );
}

const Eyes = ({ y = 27 }: { y?: number }) => (
  <>
    <circle cx="23.5" cy={y} r="3" fill={INK} />
    <circle cx="40.5" cy={y} r="3" fill={INK} />
  </>
);

// ─── Dessins ─────────────────────────────────────────────

const DRAW: Record<KidIconId, () => React.ReactNode> = {
  sun: () => (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="32" y1="6" x2="32" y2="13" stroke={C.orange} strokeWidth="5" strokeLinecap="round" transform={`rotate(${a} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="14" fill={C.yellow} {...outline} />
    </>
  ),
  "sun-cloud": () => (
    <>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line key={a} x1="44" y1="6" x2="44" y2="10" stroke={C.orange} strokeWidth="4" strokeLinecap="round" transform={`rotate(${a} 44 22)`} />
      ))}
      <circle cx="44" cy="22" r="11" fill={C.yellow} {...outline} />
      <CloudShape x={0} y={6} s={1.02} />
    </>
  ),
  cloud: () => <CloudShape x={5} y={4} s={1.05} fill={C.grey} />,
  rain: () => (
    <>
      <CloudShape x={4} y={-6} fill={C.grey} />
      {[[20, 44], [31, 48], [42, 44]].map(([x, y]) => (
        <Line key={x} d={`M${x} ${y} l-3 8`} color={C.blue} w={3.5} />
      ))}
    </>
  ),
  storm: () => (
    <>
      <CloudShape x={4} y={-8} fill={C.slate} />
      <polygon points="35,36 25,50 31,50 28,60 40,44 33,44" fill={C.yellow} {...outline} />
    </>
  ),
  snow: () => (
    <>
      <CloudShape x={4} y={-8} fill={C.grey} />
      {[[20, 50], [32, 55], [44, 50]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3.2" fill={C.sky} {...outline} />
      ))}
    </>
  ),
  moon: () => (
    <>
      <path d="M42 52A22 22 0 1 1 36 9A30 30 0 0 0 42 52Z" fill={C.yellow} {...outline} />
      <polygon points={starPoints(48, 18, 6, 2.6)} fill={C.orange} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  star: () => <polygon points={starPoints(32, 34, 25, 11)} fill={C.yellow} {...outline} />,
  rainbow: () => (
    <>
      <path d="M12 46A20 20 0 0 1 52 46" fill="none" stroke={INK} strokeWidth="19" />
      <path d="M12 46A20 20 0 0 1 52 46" fill="none" stroke={C.red} strokeWidth="5" />
      <path d="M17 46A15 15 0 0 1 47 46" fill="none" stroke={C.yellow} strokeWidth="5" />
      <path d="M22 46A10 10 0 0 1 42 46" fill="none" stroke={C.blue} strokeWidth="5" />
      <ellipse cx="11" cy="48" rx="8" ry="5.5" fill={PAPER} {...outline} />
      <ellipse cx="53" cy="48" rx="8" ry="5.5" fill={PAPER} {...outline} />
    </>
  ),
  drop: () => (
    <>
      <path d="M32 7C32 7 15 26 15 38a17 17 0 0 0 34 0C49 26 32 7 32 7Z" fill={C.blue} {...outline} />
      <path d="M23 38a9 9 0 0 0 6 8.5" fill="none" stroke={PAPER} strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  leaf: () => (
    <>
      <path d="M10 54C10 27 26 9 55 9C55 38 40 54 10 54Z" fill={C.green} {...outline} />
      <path d="M10 54L38 26" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  flower: () => (
    <>
      <Blob fill={C.pink}>
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx="32" cy="16" r="10" transform={`rotate(${a} 32 32)`} />
        ))}
      </Blob>
      <circle cx="32" cy="32" r="8" fill={C.yellow} {...outline} />
    </>
  ),
  tree: () => (
    <>
      <rect x="27" y="38" width="10" height="20" rx="2" fill={C.brown} {...outline} />
      <Blob fill={C.green}>
        <circle cx="32" cy="23" r="16" />
        <circle cx="20" cy="33" r="11" />
        <circle cx="44" cy="33" r="11" />
      </Blob>
    </>
  ),
  "face-very-happy": () => (
    <Face>
      <path d="M17 33H47A15 15 0 0 1 17 33Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 44.5Q32 40 40 44.5Q32 49 24 44.5Z" fill={C.red} />
      <path d="M19 27Q23.5 21 28 27" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M36 27Q40.5 21 45 27" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </Face>
  ),
  "face-happy": () => (
    <Face>
      <Eyes />
      <path d="M21 38Q32 49 43 38" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
    </Face>
  ),
  "face-neutral": () => (
    <Face fill={C.sky}>
      <Eyes />
      <path d="M23 42H41" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
    </Face>
  ),
  "face-sad": () => (
    <Face fill={C.sky}>
      <Eyes y={28} />
      <path d="M22 45Q32 36 42 45" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M44 36q3 4 0 7q-3-3 0-7Z" fill={C.blue} />
    </Face>
  ),
  "face-angry": () => (
    <Face fill={C.orange}>
      <path d="M17 19L27 24" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M47 19L37 24" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <Eyes y={30} />
      <path d="M22 46Q32 38 42 46" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
    </Face>
  ),
  brush: () => (
    <g transform="rotate(45 32 32)">
      <rect x="27.5" y="2" width="9" height="30" rx="4.5" fill={C.yellow} {...outline} />
      <rect x="26" y="30" width="12" height="9" rx="1.5" fill={C.grey} {...outline} />
      <path d="M26 39H38C38 50 35 57 32 61C29 57 26 50 26 39Z" fill={C.red} {...outline} />
    </g>
  ),
  book: () => (
    <>
      <path d="M5 49Q20 46 32 54Q44 46 59 49V54Q44 51 32 59Q20 51 5 54Z" fill={C.blue} {...outline} />
      <path d="M32 16Q20 9 7 13V47Q20 43 32 51Z" fill={PAPER} {...outline} />
      <path d="M32 16Q44 9 57 13V47Q44 43 32 51Z" fill={PAPER} {...outline} />
      <path d="M13 22Q21 20 26 23M13 29Q21 27 26 30M13 36Q21 34 26 37" fill="none" stroke={C.slate} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M38 23Q43 20 51 22M38 30Q43 27 51 29M38 37Q43 34 51 36" fill="none" stroke={C.slate} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  ball: () => (
    <>
      <circle cx="32" cy="32" r="23" fill={C.red} />
      <path d="M32 9C19 21 19 43 32 55C45 43 45 21 32 9Z" fill={C.yellow} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="23" fill="none" {...outline} />
      <path d="M17 20Q20 15 26 12" fill="none" stroke={PAPER} strokeWidth="3.2" strokeLinecap="round" />
    </>
  ),
  music: () => (
    <>
      <polygon points="24,14 52,8 52,20 24,26" fill={C.violet} {...outline} />
      <rect x="21" y="14" width="6" height="32" fill={C.violet} {...outline} />
      <rect x="49" y="8" width="6" height="32" fill={C.violet} {...outline} />
      <ellipse cx="17" cy="47" rx="8" ry="6" transform="rotate(-18 17 47)" fill={C.violet} {...outline} />
      <ellipse cx="45" cy="41" rx="8" ry="6" transform="rotate(-18 45 41)" fill={C.violet} {...outline} />
    </>
  ),
  puzzle: () => (
    <>
      <Blob fill={C.orange}>
        <rect x="12" y="20" width="34" height="34" rx="2" />
        <circle cx="29" cy="17" r="7" />
        <circle cx="49" cy="37" r="7" />
      </Blob>
      <circle cx="12" cy="37" r="7" fill={PAPER} {...outline} />
    </>
  ),
  pan: () => (
    <>
      <Line d="M41 42L58 57" color={C.brown} w={8} />
      <circle cx="26" cy="30" r="20" fill={C.slate} {...outline} />
      <circle cx="26" cy="30" r="14" fill={C.grey} {...outline} />
      <circle cx="26" cy="30" r="9" fill={PAPER} {...outline} />
      <circle cx="26" cy="30" r="4" fill={C.yellow} />
    </>
  ),
  wave: () => (
    <>
      <path d="M6 24q6-9 12 0t12 0t12 0t12 0V50a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6Z" fill={C.blue} {...outline} />
      <path d="M12 38q5-7 10 0t10 0t10 0t10 0" fill="none" stroke={C.sky} strokeWidth="3.4" strokeLinecap="round" />
    </>
  ),
  people: () => (
    <>
      <circle cx="21" cy="21" r="8" fill={C.pink} {...outline} />
      <path d="M7 54a14 15 0 0 1 28 0Z" fill={C.pink} {...outline} />
      <circle cx="44" cy="27" r="7" fill={C.sky} {...outline} />
      <path d="M32 55a12 13 0 0 1 24 0Z" fill={C.sky} {...outline} />
    </>
  ),
  scissors: () => (
    <>
      <Line d="M24 41L44 8" color={C.grey} w={4} />
      <Line d="M40 41L20 8" color={C.grey} w={4} />
      <circle cx="20" cy="48" r="8" fill="none" stroke={INK} strokeWidth="10" />
      <circle cx="20" cy="48" r="8" fill="none" stroke={C.red} strokeWidth="4" />
      <circle cx="44" cy="48" r="8" fill="none" stroke={INK} strokeWidth="10" />
      <circle cx="44" cy="48" r="8" fill="none" stroke={C.red} strokeWidth="4" />
      <circle cx="32" cy="28" r="2.4" fill={INK} />
    </>
  ),
  paw: () => (
    <>
      <Blob fill={C.brown}>
        <path d="M32 31C22 31 15 41 15 47C15 53 22 54 27 52C30 51 34 51 37 52C42 54 49 53 49 47C49 41 42 31 32 31Z" />
        <ellipse cx="14" cy="28" rx="5.5" ry="7" transform="rotate(-20 14 28)" />
        <ellipse cx="25" cy="16" rx="5.5" ry="7.5" transform="rotate(-6 25 16)" />
        <ellipse cx="39" cy="16" rx="5.5" ry="7.5" transform="rotate(6 39 16)" />
        <ellipse cx="50" cy="28" rx="5.5" ry="7" transform="rotate(20 50 28)" />
      </Blob>
    </>
  ),
  mask: () => (
    <>
      <path d="M5 24C14 18 23 22 32 24C41 22 50 18 59 24C60 38 51 46 42 41C38 39 36 35 32 35C28 35 26 39 22 41C13 46 4 38 5 24Z" fill={C.violet} {...outline} />
      <ellipse cx="20" cy="30" rx="6.5" ry="4.5" transform="rotate(12 20 30)" fill={INK} />
      <ellipse cx="44" cy="30" rx="6.5" ry="4.5" transform="rotate(-12 44 30)" fill={INK} />
      <polygon points={starPoints(32, 14, 6, 2.6)} fill={C.yellow} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  bike: () => (
    <>
      <circle cx="14" cy="43" r="10" fill={PAPER} {...outline} />
      <circle cx="50" cy="43" r="10" fill={PAPER} {...outline} />
      <Line d="M14 43L25 26L42 26L50 43M25 26L30 43L42 26M14 43L30 43M42 26L40 18H47" color={C.red} w={3.2} />
      <Line d="M21 21H29" color={C.blue} w={3.4} />
    </>
  ),
  car: () => (
    <>
      <path d="M15 33L21 19H43L50 33Z" fill={C.red} {...outline} />
      <path d="M20 31L24 22H31V31ZM34 31V22H41L45 31Z" fill={C.sky} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <rect x="5" y="31" width="54" height="17" rx="6" fill={C.red} {...outline} />
      <circle cx="18" cy="48" r="7.5" fill={INK} />
      <circle cx="18" cy="48" r="2.8" fill={C.grey} />
      <circle cx="46" cy="48" r="7.5" fill={INK} />
      <circle cx="46" cy="48" r="2.8" fill={C.grey} />
    </>
  ),
  house: () => (
    <>
      <rect x="11" y="28" width="42" height="27" rx="2" fill={C.yellow} {...outline} />
      <polygon points="5,31 32,8 59,31" fill={C.red} {...outline} />
      <rect x="26" y="39" width="11" height="16" rx="2" fill={C.brown} {...outline} />
      <rect x="41" y="35" width="8" height="8" rx="1.5" fill={C.sky} stroke={INK} strokeWidth="2" />
      <rect x="15" y="35" width="8" height="8" rx="1.5" fill={C.sky} stroke={INK} strokeWidth="2" />
    </>
  ),
  backpack: () => (
    <>
      <path d="M24 16A8 8 0 0 1 40 16" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <rect x="13" y="14" width="38" height="43" rx="13" fill={C.blue} {...outline} />
      <rect x="20" y="34" width="24" height="17" rx="5" fill={C.sky} {...outline} />
      <path d="M26 42H38" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M17 26Q32 33 47 26" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  cake: () => (
    <>
      <rect x="29" y="16" width="6" height="14" rx="1.5" fill={C.sky} {...outline} />
      <path d="M32 5C37 10 37 14 32 15C27 14 27 10 32 5Z" fill={C.orange} {...outline} />
      <rect x="9" y="30" width="46" height="26" rx="5" fill={C.pink} {...outline} />
      <path d="M9 36H55V42Q49.5 49 44 42T33 42T22 42T11 42Z" fill={PAPER} {...outline} />
      <circle cx="20" cy="52" r="1.8" fill={C.yellow} />
      <circle cx="32" cy="50" r="1.8" fill={C.yellow} />
      <circle cx="44" cy="52" r="1.8" fill={C.yellow} />
    </>
  ),
  heart: () => (
    <>
      <path d="M32 55C10 40 7 25 15 17C22 11 30 14 32 21C34 14 42 11 49 17C57 25 54 40 32 55Z" fill={C.red} {...outline} />
      <path d="M16 26Q17 21 22 20" fill="none" stroke={PAPER} strokeWidth="3.2" strokeLinecap="round" />
    </>
  ),
  cup: () => (
    <>
      <path d="M24 13Q20 9 24 4M34 13Q30 9 34 4" fill="none" stroke={C.slate} strokeWidth="3" strokeLinecap="round" />
      <path d="M43 26H48A7 7 0 0 1 48 40H42" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M43 26H48A7 7 0 0 1 48 40H42" fill="none" stroke={C.orange} strokeWidth="3" strokeLinecap="round" />
      <path d="M10 19H44V42A13 13 0 0 1 31 55H23A13 13 0 0 1 10 42Z" fill={C.orange} {...outline} />
      <path d="M17 28V40" fill="none" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  check: () => (
    <>
      <circle cx="32" cy="32" r="24" fill={C.green} {...outline} />
      <path d="M20 33L28 41L44 24" fill="none" stroke={PAPER} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cross: () => (
    <>
      <circle cx="32" cy="32" r="24" fill={C.red} {...outline} />
      <path d="M22 22L42 42M42 22L22 42" fill="none" stroke={PAPER} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  bell: () => (
    <>
      <path d="M32 6A3.5 3.5 0 0 1 35.5 9.5V11C44 13 48 21 48 31L52 43H12L16 31C16 21 20 13 28.5 11V9.5A3.5 3.5 0 0 1 32 6Z" fill={C.yellow} {...outline} />
      <path d="M26 49A6 6 0 0 0 38 49Z" fill={C.orange} {...outline} />
      <path d="M21 30Q21 22 26 18" fill="none" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  gift: () => (
    <>
      <path d="M32 24C26 8 14 11 17 18C19 23 28 23 32 24ZM32 24C38 8 50 11 47 18C45 23 36 23 32 24Z" fill={C.yellow} {...outline} />
      <rect x="11" y="30" width="42" height="26" rx="3" fill={C.red} {...outline} />
      <rect x="7" y="22" width="50" height="11" rx="3" fill={C.orange} {...outline} />
      <rect x="28" y="22" width="8" height="34" fill={C.yellow} {...outline} />
    </>
  ),
};

// ─── Composant ───────────────────────────────────────────

export interface KidIconProps {
  id: KidIconId;
  /** Taille en pixels (carré). 24 en liste, 56 en saisie, 96 en mode enfant. */
  size?: number;
  className?: string;
  /** Vrai quand un libellé visible accompagne déjà l'image (évite la double lecture). */
  decorative?: boolean;
}

export function KidIcon({ id, size = 48, className, decorative = false }: KidIconProps) {
  const draw = DRAW[id];
  if (!draw) return null;
  const label = KID_ICON_LABELS[id];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      data-kid-icon={id}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      {draw()}
    </svg>
  );
}
