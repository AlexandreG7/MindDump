/**
 * Bibliothèque d'images neutres du Semainier (83 icônes).
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
 * Les identifiants viennent d'une seule source, `src/lib/kidIconIds.ts` (partagée
 * avec l'API) : ajouter une image commence là, le compilateur signale ici le
 * dessin et la catégorie manquants.
 */
import React from "react";
import { KID_ICONS, isKidIconId, type KidIconId } from "@/lib/kidIconIds";

export { isKidIconId };
export type { KidIconId };

/** Tous les identifiants, dans l'ordre de la bibliothèque (source : src/lib/kidIconIds.ts). */
export const KID_ICON_IDS: readonly KidIconId[] = KID_ICONS.map((i) => i.id);

export type KidIconCategory =
  | "meteo" | "humeur" | "nourriture" | "animaux" | "nature" | "activite"
  | "jeux" | "transport" | "lieux" | "objet" | "symbole";

/** L'ordre des clés est l'ordre des onglets du sélecteur. */
export const KID_ICON_CATEGORY_LABELS: Record<KidIconCategory, string> = {
  meteo: "Météo",
  humeur: "Visages",
  nourriture: "Nourriture",
  animaux: "Animaux",
  nature: "Nature",
  activite: "Activités",
  jeux: "Jeux",
  transport: "Transports",
  lieux: "Lieux",
  objet: "Objets",
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
  apple: "pomme",
  carrot: "carotte",
  plate: "assiette et couverts",
  sandwich: "sandwich",
  "ice-cream": "glace à deux boules",
  glass: "verre avec une paille",
  cat: "visage de chat",
  dog: "visage de chien",
  fish: "poisson",
  bird: "oiseau",
  rabbit: "visage de lapin",
  butterfly: "papillon",
  school: "bâtiment avec une horloge",
  slide: "toboggan",
  beach: "parasol sur le sable",
  mountain: "montagne",
  shop: "boutique à store rayé",
  bus: "bus",
  train: "train vu de face",
  plane: "avion",
  scooter: "trottinette",
  boat: "bateau à voile",
  blocks: "cubes de jeu",
  teddy: "visage d'ours en peluche",
  football: "ballon de football",
  racket: "raquette",
  guitar: "guitare",
  drum: "tambour et baguettes",
  camera: "appareil photo",
  tablet: "tablette",
  clock: "horloge",
  umbrella: "parapluie",
  shoe: "chaussure de sport",
  hat: "chapeau de paille",
  crown: "couronne",
  rocket: "fusée",
  balloon: "ballons de baudruche",
  flag: "fanion",
  pencil: "crayon",
  trophy: "trophée",
  bolt: "éclair",
  flame: "flamme",
  target: "cible et flèche",
};

export const KID_ICON_CATEGORIES: Record<KidIconId, KidIconCategory> = {
  sun: "meteo", "sun-cloud": "meteo", cloud: "meteo", rain: "meteo", storm: "meteo",
  snow: "meteo", moon: "meteo", rainbow: "meteo",
  "face-very-happy": "humeur", "face-happy": "humeur", "face-neutral": "humeur",
  "face-sad": "humeur", "face-angry": "humeur",
  apple: "nourriture", carrot: "nourriture", plate: "nourriture", sandwich: "nourriture",
  "ice-cream": "nourriture", glass: "nourriture", cake: "nourriture", cup: "nourriture",
  cat: "animaux", dog: "animaux", fish: "animaux", bird: "animaux", rabbit: "animaux",
  butterfly: "animaux", paw: "animaux",
  drop: "nature", leaf: "nature", flower: "nature", tree: "nature",
  brush: "activite", book: "activite", music: "activite", pan: "activite", wave: "activite",
  people: "activite", scissors: "activite", mask: "activite", pencil: "activite",
  blocks: "jeux", teddy: "jeux", football: "jeux", racket: "jeux", guitar: "jeux", drum: "jeux",
  balloon: "jeux", puzzle: "jeux", ball: "jeux", rocket: "jeux",
  bus: "transport", train: "transport", plane: "transport", scooter: "transport",
  boat: "transport", bike: "transport", car: "transport",
  school: "lieux", slide: "lieux", beach: "lieux", mountain: "lieux", shop: "lieux", house: "lieux",
  camera: "objet", tablet: "objet", clock: "objet", umbrella: "objet", shoe: "objet",
  hat: "objet", crown: "objet", backpack: "objet", bell: "objet", gift: "objet",
  star: "symbole", heart: "symbole", check: "symbole", cross: "symbole", trophy: "symbole",
  bolt: "symbole", flame: "symbole", target: "symbole", flag: "symbole",
};

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

function polyPoints(cx: number, cy: number, R: number, n: number, startDeg: number) {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (startDeg + (i * 360) / n) * (Math.PI / 180);
    pts.push(`${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`);
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
      <Line d="M41 36H58" color={C.brown} w={8} />
      <ellipse cx="24" cy="36" rx="21" ry="16" fill={C.slate} {...outline} />
      <ellipse cx="24" cy="34" rx="15" ry="10.5" fill={C.grey} {...outline} />
      <path d="M13 34C13 28 19 25 26 26C32 27 36 30 33 36C30 41 17 42 13 34Z" fill={PAPER} {...outline} />
      <circle cx="23" cy="33" r="4.4" fill={C.yellow} stroke={INK} strokeWidth="2" />
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
      <Line d="M25 40L45 7" color={C.grey} w={6} />
      <Line d="M39 40L19 7" color={C.grey} w={6} />
      <circle cx="19" cy="48" r="8" fill="none" stroke={INK} strokeWidth="11" />
      <circle cx="19" cy="48" r="8" fill="none" stroke={C.red} strokeWidth="5.5" />
      <circle cx="45" cy="48" r="8" fill="none" stroke={INK} strokeWidth="11" />
      <circle cx="45" cy="48" r="8" fill="none" stroke={C.red} strokeWidth="5.5" />
      <circle cx="32" cy="27" r="2.8" fill={INK} stroke={PAPER} strokeWidth="1.2" />
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
      <circle cx="14" cy="43" r="9.5" fill="none" stroke={INK} strokeWidth="9.5" />
      <circle cx="14" cy="43" r="9.5" fill="none" stroke={C.slate} strokeWidth="4.2" />
      <circle cx="50" cy="43" r="9.5" fill="none" stroke={INK} strokeWidth="9.5" />
      <circle cx="50" cy="43" r="9.5" fill="none" stroke={C.slate} strokeWidth="4.2" />
      <Line d="M14 43L25 26L42 26L50 43M25 26L30 43L42 26M14 43L30 43M42 26L40 18H47" color={C.red} w={4.6} />
      <Line d="M20 21H30" color={C.blue} w={4.8} />
      <circle cx="30" cy="43" r="3" fill={C.yellow} stroke={INK} strokeWidth="1.8" />
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
  // ── Nourriture ──
  apple: () => (
    <>
      <Line d="M32 21Q32 13 36 8" color={C.brown} w={3} />
      <path d="M32 21C26 15 12 18 12 34C12 47 21 57 28 56C31 55 33 55 36 56C43 57 52 47 52 34C52 18 38 15 32 21Z" fill={C.red} {...outline} />
      <path d="M37 15C40 8 48 8 51 11C48 18 41 18 37 15Z" fill={C.green} {...outline} />
      <path d="M18 31Q19 25 24 24" fill="none" stroke={PAPER} strokeWidth="3.2" strokeLinecap="round" />
    </>
  ),
  carrot: () => (
    <g transform="rotate(32 32 32)">
      <path d="M32 21C27 15 24 9 26 4C30 7 32 13 32 21Z" fill={C.green} {...outline} />
      <path d="M32 21C32 13 35 7 40 5C42 10 38 17 32 21Z" fill={C.green} {...outline} />
      <path d="M24 22C24 17 40 17 40 22L34 56C33.4 59.5 30.6 59.5 30 56Z" fill={C.orange} {...outline} />
      <path d="M27.5 29H31M33 37H36.5M29.5 45H32.5" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  ),
  plate: () => (
    <>
      <path d="M4 9H6.5V18H8.5V9H11V18H13V9H15.5V20Q15.5 25 12.5 26V56H7V26Q4 25 4 20Z" fill={C.slate} {...outline} strokeWidth="2.6" />
      <path d="M53 8Q61 12 60 27H56.5V56H53Z" fill={C.slate} {...outline} strokeWidth="2.6" />
      <circle cx="33" cy="32" r="18.5" fill={PAPER} {...outline} />
      <circle cx="33" cy="32" r="11.5" fill={C.sky} stroke={INK} strokeWidth="2.4" />
    </>
  ),
  sandwich: () => (
    <>
      <path d="M8 30C4 20 12 11 32 11C52 11 60 20 56 30Z" fill={C.orange} {...outline} />
      <circle cx="22" cy="19" r="1.8" fill={PAPER} />
      <circle cx="33" cy="16" r="1.8" fill={PAPER} />
      <circle cx="43" cy="20" r="1.8" fill={PAPER} />
      <rect x="8" y="40" width="48" height="8" rx="4" fill={C.pink} {...outline} />
      <path d="M7 30H57V33Q51 40 44 34Q38 40 32 34Q26 40 20 34Q14 40 7 33Z" fill={C.green} {...outline} />
      <path d="M10 45H54V52Q54 57 49 57H15Q10 57 10 52Z" fill={C.orange} {...outline} />
    </>
  ),
  "ice-cream": () => (
    <>
      <path d="M20 34H44L32 60Z" fill={C.orange} {...outline} />
      <path d="M25.5 39L31 50M38.5 39L33 50" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="17" r="9.5" fill={C.yellow} {...outline} />
      <circle cx="32" cy="31" r="12.5" fill={C.pink} {...outline} />
      <path d="M23 29Q24 24 29 23" fill="none" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  glass: () => (
    <>
      <Line d="M38 30L45 4" color={C.red} w={3.4} />
      <path d="M17.4 26H46.6L44 55Q43.8 57 42 57H22Q20.2 57 20 55Z" fill={C.blue} />
      <path d="M16 10H48L44.4 55.5Q44.2 58 42 58H22Q19.8 58 19.6 55.5Z" fill="none" {...outline} />
      <path d="M23 32V47" fill="none" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  // ── Animaux ──
  cat: () => (
    <>
      <path d="M12 26L14 6L27 15Q32 14 37 15L50 6L52 26Q54 33 52 40Q48 54 32 54Q16 54 12 40Q10 33 12 26Z" fill={C.orange} {...outline} />
      <path d="M17.5 14.5L18 21L23 17.5ZM46.5 14.5L46 21L41 17.5Z" fill={C.pink} />
      <Eyes y={31} />
      <path d="M29.2 38.5H34.8L32 42Z" fill={C.pink} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 42V44.5M32 44.5Q29 48 26 45.5M32 44.5Q35 48 38 45.5" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 37L16 39M3 45L16 43M61 37L48 39M61 45L48 43" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  dog: () => (
    <>
      <path d="M32 9C43 9 49 18 49 30C49 45 42 56 32 56C22 56 15 45 15 30C15 18 21 9 32 9Z" fill={C.yellow} {...outline} />
      <path d="M17 14C8 13 4 28 8 42C14 43 19 35 20 24Z" fill={C.brown} {...outline} />
      <path d="M47 14C56 13 60 28 56 42C50 43 45 35 44 24Z" fill={C.brown} {...outline} />
      <ellipse cx="32" cy="43" rx="11.5" ry="9" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      <circle cx="24.5" cy="28" r="3" fill={INK} />
      <circle cx="39.5" cy="28" r="3" fill={INK} />
      <ellipse cx="32" cy="38.5" rx="4.3" ry="3.2" fill={INK} />
      <path d="M32 41.5V46M32 46Q28 50 25 47M32 46Q36 50 39 47" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  fish: () => (
    <>
      <path d="M43 32L59 18Q55 32 59 46Z" fill={C.red} {...outline} />
      <path d="M22 20Q29 8 38 20Z" fill={C.red} {...outline} />
      <path d="M22 44Q28 54 36 44Z" fill={C.red} {...outline} />
      <ellipse cx="27" cy="32" rx="20" ry="14" fill={C.orange} {...outline} />
      <path d="M33 21Q38 32 33 43" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="15.5" cy="28" r="4" fill={PAPER} stroke={INK} strokeWidth="2.2" />
      <circle cx="14.7" cy="28" r="1.7" fill={INK} />
    </>
  ),
  bird: () => (
    <>
      <path d="M44 30L61 21L57 35L62 47L44 41Z" fill={C.violet} {...outline} />
      <Line d="M26 50V57M26 57H21M35 50V57M35 57H30" color={C.orange} w={2.4} />
      <circle cx="29" cy="33" r="18.5" fill={C.blue} {...outline} />
      <path d="M12 27L2 31L12.5 36Z" fill={C.orange} {...outline} />
      <path d="M22 38Q33 27 45 38Q40 49 29 46Z" fill={C.sky} {...outline} strokeWidth="2.6" />
      <circle cx="21" cy="26.5" r="3.2" fill={INK} />
      <circle cx="22" cy="25.5" r="1" fill={PAPER} />
    </>
  ),
  rabbit: () => (
    <>
      <path d="M20 32C13 16 15 3 21.5 3C28 3 30 17 28.5 32Z" fill={PAPER} {...outline} />
      <path d="M22 26C19.5 17 19 11 21.5 9.5C24 11 25.5 17 25.5 26Z" fill={C.pink} />
      <g transform="translate(64 0) scale(-1 1)">
        <path d="M20 32C13 16 15 3 21.5 3C28 3 30 17 28.5 32Z" fill={PAPER} {...outline} />
        <path d="M22 26C19.5 17 19 11 21.5 9.5C24 11 25.5 17 25.5 26Z" fill={C.pink} />
      </g>
      <circle cx="32" cy="41" r="19" fill={PAPER} {...outline} />
      <circle cx="24.5" cy="38" r="3" fill={INK} />
      <circle cx="39.5" cy="38" r="3" fill={INK} />
      <circle cx="19.5" cy="46" r="3.2" fill={C.pink} />
      <circle cx="44.5" cy="46" r="3.2" fill={C.pink} />
      <path d="M29.3 43.5H34.7L32 46.5Z" fill={C.pink} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 46.5V49M32 49Q29 52 26.5 50M32 49Q35 52 37.5 50" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  butterfly: () => (
    <>
      <path d="M29 33C20 33 9 39 13 50C17 58 27 53 29 41Z" fill={C.pink} {...outline} />
      <path d="M35 33C44 33 55 39 51 50C47 58 37 53 35 41Z" fill={C.pink} {...outline} />
      <path d="M29 30C21 8 5 10 7 25C8 33 19 35 29 32Z" fill={C.violet} {...outline} />
      <path d="M35 30C43 8 59 10 57 25C56 33 45 35 35 32Z" fill={C.violet} {...outline} />
      <circle cx="18" cy="23" r="4.2" fill={PAPER} />
      <circle cx="46" cy="23" r="4.2" fill={PAPER} />
      <circle cx="21" cy="46" r="2.8" fill={PAPER} />
      <circle cx="43" cy="46" r="2.8" fill={PAPER} />
      <path d="M30.5 17Q27 8 23 6M33.5 17Q37 8 41 6" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="28.5" y="15" width="7" height="39" rx="3.5" fill={INK} />
    </>
  ),
  // ── Lieux ──
  school: () => (
    <>
      <rect x="5" y="31" width="54" height="25" rx="2" fill={C.red} {...outline} />
      <rect x="23" y="15" width="18" height="18" rx="2" fill={C.red} {...outline} />
      <polygon points="20,16 32,4 44,16" fill={C.blue} {...outline} />
      <circle cx="32" cy="24" r="5.2" fill={PAPER} stroke={INK} strokeWidth="2.2" />
      <path d="M32 21V24H34.5" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26.5" y="42" width="11" height="14" rx="2" fill={C.brown} {...outline} strokeWidth="2.6" />
      <rect x="10" y="38" width="10" height="8" rx="1.5" fill={C.sky} stroke={INK} strokeWidth="2.2" />
      <rect x="44" y="38" width="10" height="8" rx="1.5" fill={C.sky} stroke={INK} strokeWidth="2.2" />
    </>
  ),
  slide: () => (
    <>
      <Line d="M27 17C38 19 40 40 54 53" color={C.red} w={5} />
      <rect x="5" y="17" width="19" height="41" rx="2" fill={C.blue} {...outline} />
      <path d="M5 30H24M5 38H24M5 46H24M5 54H24" fill="none" stroke={INK} strokeWidth="2.4" />
      <rect x="2" y="11" width="28" height="7" rx="2.5" fill={C.yellow} {...outline} />
    </>
  ),
  beach: () => (
    <>
      <Line d="M32 28V56" color={C.brown} w={3} />
      <path d="M6 30C6 15 19 6 32 6C45 6 58 15 58 30Q51.5 36 45 30Q38.5 36 32 30Q25.5 36 19 30Q12.5 36 6 30Z" fill={C.red} {...outline} />
      <path d="M32 6C27 12 24 20 24 31Q28 35 32 30Q36 35 40 31C40 20 37 12 32 6Z" fill={PAPER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M2 53Q16 46 32 52T62 51V62H2Z" fill={C.yellow} {...outline} />
    </>
  ),
  mountain: () => (
    <>
      <circle cx="51" cy="14" r="6.5" fill={C.yellow} {...outline} />
      <polygon points="30,57 46,30 62,57" fill={C.green} {...outline} />
      <polygon points="2,57 26,11 50,57" fill={C.slate} {...outline} />
      <path d="M26 11L17 28L22 25L26 29L31 25L35.5 28Z" fill={PAPER} {...outline} strokeWidth="2.4" />
    </>
  ),
  shop: () => (
    <>
      <rect x="9" y="26" width="46" height="30" rx="2" fill={C.yellow} {...outline} />
      <rect x="14" y="37" width="20" height="14" rx="1.5" fill={C.sky} stroke={INK} strokeWidth="2.4" />
      <rect x="40" y="35" width="10" height="21" rx="1.5" fill={C.brown} stroke={INK} strokeWidth="2.4" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${6 + i * 13} 9H${19 + i * 13}V26A6.5 6.5 0 0 1 ${6 + i * 13} 26Z`} fill={i % 2 === 0 ? C.red : PAPER} {...outline} />
      ))}
    </>
  ),
  // ── Transports ──
  bus: () => (
    <>
      <rect x="3" y="13" width="58" height="38" rx="7" fill={C.yellow} {...outline} />
      <rect x="8" y="19" width="11" height="11" rx="2" fill={C.sky} stroke={INK} strokeWidth="2.2" />
      <rect x="22" y="19" width="11" height="11" rx="2" fill={C.sky} stroke={INK} strokeWidth="2.2" />
      <rect x="36" y="19" width="11" height="11" rx="2" fill={C.sky} stroke={INK} strokeWidth="2.2" />
      <path d="M50 19H56Q58 19 58 21V30H50Z" fill={C.sky} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M3 38H61" fill="none" stroke={INK} strokeWidth="2.4" />
      <circle cx="17" cy="51" r="7.5" fill={INK} />
      <circle cx="17" cy="51" r="2.8" fill={C.grey} />
      <circle cx="47" cy="51" r="7.5" fill={INK} />
      <circle cx="47" cy="51" r="2.8" fill={C.grey} />
    </>
  ),
  train: () => (
    <>
      <path d="M8 60L16 50M56 60L48 50" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <rect x="13" y="5" width="38" height="46" rx="11" fill={C.blue} {...outline} />
      <rect x="19" y="12" width="26" height="15" rx="4" fill={C.sky} stroke={INK} strokeWidth="2.4" />
      <path d="M32 12V27" fill="none" stroke={INK} strokeWidth="2.4" />
      <circle cx="22" cy="39" r="4" fill={C.yellow} stroke={INK} strokeWidth="2.4" />
      <circle cx="42" cy="39" r="4" fill={C.yellow} stroke={INK} strokeWidth="2.4" />
      <rect x="17" y="47" width="30" height="7" rx="2.5" fill={C.slate} {...outline} strokeWidth="2.6" />
    </>
  ),
  plane: () => (
    <>
      <path d="M10 33L5 14H14L25 33Z" fill={C.red} {...outline} />
      <path d="M4 34Q4 26 18 26H46Q61 26 61 34Q61 41 46 41H18Q4 41 4 34Z" fill={PAPER} {...outline} />
      <path d="M52 27.5Q59 28 59.5 33H51Z" fill={C.sky} />
      <circle cx="18" cy="33.5" r="2.2" fill={C.sky} />
      <circle cx="26" cy="33.5" r="2.2" fill={C.sky} />
      <circle cx="34" cy="33.5" r="2.2" fill={C.sky} />
      <circle cx="42" cy="33.5" r="2.2" fill={C.sky} />
      <path d="M27 38H43L33 59H23Z" fill={C.blue} {...outline} />
    </>
  ),
  scooter: () => (
    <>
      <circle cx="13" cy="52" r="7.5" fill={INK} />
      <circle cx="13" cy="52" r="2.8" fill={C.grey} />
      <circle cx="53" cy="52" r="7.5" fill={INK} />
      <circle cx="53" cy="52" r="2.8" fill={C.grey} />
      <Line d="M47 44L52 11" color={C.slate} w={3.4} />
      <Line d="M12 44H49" color={C.red} w={5} />
      <Line d="M44 10H59" color={C.blue} w={4} />
    </>
  ),
  boat: () => (
    <>
      <path d="M30 17L10 40H30Z" fill={C.yellow} {...outline} />
      <path d="M35 8L56 40H35Z" fill={PAPER} {...outline} />
      <Line d="M32.5 6V41" color={C.brown} w={3} />
      <path d="M5 40H59L51 53Q50 55 48 55H16Q14 55 13 53Z" fill={C.red} {...outline} />
      <path d="M2 54Q10 49 18 54T34 54T50 54T62 54V60Q62 62 60 62H4Q2 62 2 60Z" fill={C.blue} {...outline} />
    </>
  ),
  // ── Jeux et objets ──
  blocks: () => (
    <>
      <rect x="5" y="34" width="25" height="25" rx="3.5" fill={C.red} {...outline} />
      <circle cx="17.5" cy="46.5" r="6" fill={PAPER} />
      <rect x="34" y="34" width="25" height="25" rx="3.5" fill={C.blue} {...outline} />
      <polygon points="46.5,40.5 40.5,52.5 52.5,52.5" fill={PAPER} />
      <g transform="rotate(-9 32 22)">
        <rect x="19.5" y="9" width="25" height="25" rx="3.5" fill={C.yellow} {...outline} />
        <rect x="27.5" y="17" width="9" height="9" rx="1.5" fill={C.orange} />
      </g>
    </>
  ),
  teddy: () => (
    <>
      <circle cx="14" cy="15" r="9" fill={C.brown} {...outline} />
      <circle cx="14" cy="15" r="4" fill={C.pink} />
      <circle cx="50" cy="15" r="9" fill={C.brown} {...outline} />
      <circle cx="50" cy="15" r="4" fill={C.pink} />
      <circle cx="32" cy="33" r="22" fill={C.brown} {...outline} />
      <ellipse cx="32" cy="41" rx="10.5" ry="8.5" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      <circle cx="23.5" cy="29" r="3" fill={INK} />
      <circle cx="40.5" cy="29" r="3" fill={INK} />
      <ellipse cx="32" cy="37.8" rx="4" ry="3" fill={INK} />
      <path d="M32 40.5V44M32 44Q28.5 47.5 25.5 45M32 44Q35.5 47.5 38.5 45" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 56L21 50.5V61.5ZM32 56L43 50.5V61.5Z" fill={C.red} {...outline} strokeWidth="2.6" />
      <circle cx="32" cy="56" r="3.4" fill={C.red} {...outline} strokeWidth="2.4" />
    </>
  ),
  football: () => (
    <>
      <defs>
        <clipPath id="ki-fb-clip"><circle cx="32" cy="32" r="24" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="24" fill={PAPER} />
      <g clipPath="url(#ki-fb-clip)">
        {[0, 1, 2, 3, 4].map((k) => {
          const a = (-90 + k * 72) * (Math.PI / 180);
          const x1 = 32 + 8.5 * Math.cos(a), y1 = 32 + 8.5 * Math.sin(a);
          const x2 = 32 + 17 * Math.cos(a), y2 = 32 + 17 * Math.sin(a);
          const cx = 32 + 27 * Math.cos(a + 0.0), cy = 32 + 27 * Math.sin(a);
          const pts = [0, 1, 2, 3, 4].map((j) => {
            const b = a + Math.PI + (j * 72 * Math.PI) / 180;
            return `${(cx + 9 * Math.cos(b)).toFixed(1)},${(cy + 9 * Math.sin(b)).toFixed(1)}`;
          }).join(" ");
          return (
            <g key={k}>
              <line x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
              <polygon points={pts} fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            </g>
          );
        })}
      </g>
      <polygon points={polyPoints(32, 32, 9, 5, -90)} fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="24" fill="none" {...outline} />
    </>
  ),
  racket: () => (
    <g transform="rotate(38 32 32)">
      <defs>
        <clipPath id="ki-rk-clip"><ellipse cx="32" cy="22" rx="12.5" ry="16.5" /></clipPath>
      </defs>
      <rect x="28.5" y="36" width="7" height="23" rx="3.5" fill={C.brown} {...outline} />
      <ellipse cx="32" cy="22" rx="12.5" ry="16.5" fill={PAPER} stroke={INK} strokeWidth="8" />
      <g clipPath="url(#ki-rk-clip)" stroke={INK} strokeWidth="1.5">
        <path d="M23 4V40M32 4V40M41 4V40M16 14H48M16 22H48M16 30H48" fill="none" />
      </g>
      <ellipse cx="32" cy="22" rx="12.5" ry="16.5" fill="none" stroke={C.red} strokeWidth="2.8" />
    </g>
  ),
  guitar: () => (
    <g transform="rotate(40 32 32)">
      <rect x="29.3" y="7" width="5.4" height="24" fill={C.brown} {...outline} strokeWidth="2.6" />
      <rect x="27" y="1" width="10" height="9" rx="2.5" fill={C.brown} {...outline} strokeWidth="2.6" />
      <Blob fill={C.orange}>
        <circle cx="32" cy="47" r="13" />
        <circle cx="32" cy="30.5" r="8.5" />
      </Blob>
      <circle cx="32" cy="42" r="4.8" fill={INK} />
      <rect x="27" y="52" width="10" height="3.4" rx="1.2" fill={INK} />
      <path d="M32 7V42" fill="none" stroke={PAPER} strokeWidth="1.2" />
    </g>
  ),
  drum: () => (
    <>
      <path d="M9 24V46Q9 55 32 55Q55 55 55 46V24Z" fill={C.red} {...outline} />
      <path d="M12 31L22 49L32 31L42 49L52 31" fill="none" stroke={PAPER} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="32" cy="24" rx="23" ry="9" fill={PAPER} {...outline} />
      <Line d="M12 4L29 21" color={C.yellow} w={3.4} />
      <Line d="M52 4L35 21" color={C.yellow} w={3.4} />
    </>
  ),
  camera: () => (
    <>
      <rect x="21" y="9" width="22" height="12" rx="3" fill={C.slate} {...outline} />
      <rect x="5" y="16" width="54" height="40" rx="8" fill={C.slate} {...outline} />
      <rect x="9" y="21" width="10" height="5" rx="1.8" fill={C.yellow} />
      <circle cx="51" cy="24" r="3" fill={C.red} />
      <circle cx="32" cy="37" r="14" fill={PAPER} {...outline} />
      <circle cx="32" cy="37" r="8" fill={C.blue} stroke={INK} strokeWidth="2.4" />
      <circle cx="29" cy="34" r="2.2" fill={PAPER} />
    </>
  ),
  tablet: () => (
    <>
      <rect x="9" y="4" width="46" height="56" rx="8" fill={C.slate} {...outline} />
      <rect x="14" y="10" width="36" height="38" rx="2.5" fill={C.sky} stroke={INK} strokeWidth="2.4" />
      <rect x="19" y="15" width="12" height="12" rx="3" fill={C.orange} />
      <rect x="34" y="15" width="12" height="12" rx="3" fill={C.green} />
      <rect x="19" y="31" width="12" height="12" rx="3" fill={C.pink} />
      <rect x="34" y="31" width="12" height="12" rx="3" fill={C.yellow} />
      <circle cx="32" cy="54" r="2.4" fill={PAPER} />
    </>
  ),
  clock: () => (
    <>
      <circle cx="32" cy="32" r="25" fill={C.red} {...outline} />
      <circle cx="32" cy="32" r="18.5" fill={PAPER} stroke={INK} strokeWidth="2.4" />
      <path d="M32 17.5V21M32 43V46.5M17.5 32H21M43 32H46.5" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32 32L26.5 22.5" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 32L43 26" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="32" r="2.4" fill={INK} />
    </>
  ),
  umbrella: () => (
    <>
      <Line d="M32 34V51Q32 58 25.5 58Q21.5 58 21.5 54" color={C.brown} w={3} />
      <Line d="M32 8V4" color={C.slate} w={2.6} />
      <path d="M6 34C6 18 19 8 32 8C45 8 58 18 58 34Q51.5 40 45 34Q38.5 40 32 34Q25.5 40 19 34Q12.5 40 6 34Z" fill={C.red} {...outline} />
      <path d="M32 8Q23 20 19 34Q25.5 40 32 34Q38.5 40 45 34Q41 20 32 8Z" fill={PAPER} />
      <path d="M32 8Q22 19 19 34M32 8Q42 19 45 34" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  shoe: () => (
    <>
      <path d="M6 46V21C6 17.5 8 16 11.5 16H20C22 24 28 28 36 29.5C49 32 57 37 59 46Z" fill={C.red} {...outline} />
      <path d="M24 22.5L21 28M29 26.5L26 32M34 29.5L32 35" fill="none" stroke={PAPER} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M44 33Q50 37 51 46" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="3" y="43" width="58" height="12" rx="6" fill={PAPER} {...outline} />
    </>
  ),
  hat: () => (
    <>
      <ellipse cx="32" cy="42" rx="29" ry="10.5" fill={C.yellow} {...outline} />
      <path d="M16 40C16 12 48 12 48 40Q32 47 16 40Z" fill={C.yellow} {...outline} />
      <path d="M16.5 34.5Q32 41.5 47.5 34.5L48 40Q32 47 16 40Z" fill={C.red} {...outline} />
    </>
  ),
  crown: () => (
    <>
      <path d="M8 52L5 19L20 32L32 12L44 32L59 19L56 52Z" fill={C.yellow} {...outline} />
      <rect x="7" y="44" width="50" height="13" rx="3" fill={C.orange} {...outline} />
      <circle cx="19" cy="50.5" r="2.7" fill={C.blue} />
      <circle cx="32" cy="50.5" r="2.7" fill={C.red} />
      <circle cx="45" cy="50.5" r="2.7" fill={C.green} />
      <circle cx="5" cy="17" r="3.4" fill={C.red} {...outline} strokeWidth="2.4" />
      <circle cx="32" cy="10" r="3.4" fill={C.red} {...outline} strokeWidth="2.4" />
      <circle cx="59" cy="17" r="3.4" fill={C.red} {...outline} strokeWidth="2.4" />
    </>
  ),
  rocket: () => (
    <g transform="rotate(35 32 32)">
      <path d="M26 44Q32 62 38 44Z" fill={C.orange} {...outline} />
      <path d="M22 35L10 49L22.5 46.5ZM42 35L54 49L41.5 46.5Z" fill={C.red} {...outline} />
      <path d="M32 3C42 11 44 26 42 44H22C20 26 22 11 32 3Z" fill={PAPER} {...outline} />
      <path d="M32 3C37 7 40 12 41.2 19H22.8C24 12 27 7 32 3Z" fill={C.red} {...outline} />
      <circle cx="32" cy="31" r="5.5" fill={C.sky} stroke={INK} strokeWidth="2.4" />
    </g>
  ),
  balloon: () => (
    <>
      <g transform="translate(22 9) scale(0.74)">
        <path d="M32 47Q38 53 32 58Q27 62 32 67" fill="none" stroke={C.slate} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M32 4C46 4 52 16 50 26C48 36 38 42 32 42C26 42 16 36 14 26C12 16 18 4 32 4Z" fill={C.yellow} {...outline} />
        <path d="M32 42L26.5 49.5H37.5Z" fill={C.yellow} {...outline} />
      </g>
      <g transform="translate(-3 4) scale(0.92)">
        <path d="M32 47Q26 52 32 57Q38 61 32 64" fill="none" stroke={C.slate} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M32 4C46 4 52 16 50 26C48 36 38 42 32 42C26 42 16 36 14 26C12 16 18 4 32 4Z" fill={C.red} {...outline} />
        <path d="M32 42L26.5 49.5H37.5Z" fill={C.red} {...outline} />
        <path d="M21 17Q24 11 30 10" fill="none" stroke={PAPER} strokeWidth="3.4" strokeLinecap="round" />
      </g>
    </>
  ),
  flag: () => (
    <>
      <path d="M15 9L58 21L15 33Z" fill={C.red} {...outline} />
      <circle cx="26" cy="21" r="3.8" fill={C.yellow} />
      <rect x="8" y="8" width="7" height="51" rx="3" fill={C.brown} {...outline} strokeWidth="2.6" />
      <circle cx="11.5" cy="7" r="4.2" fill={C.yellow} {...outline} strokeWidth="2.6" />
    </>
  ),
  pencil: () => (
    <g transform="rotate(40 32 32)">
      <rect x="25" y="3" width="14" height="10" rx="3.5" fill={C.pink} {...outline} />
      <rect x="25" y="12" width="14" height="6" fill={C.grey} {...outline} />
      <rect x="25" y="17" width="14" height="28" fill={C.yellow} {...outline} />
      <path d="M25 45H39L32 59Z" fill={PAPER} {...outline} />
      <path d="M29.6 52.4H34.4L32 59Z" fill={INK} />
      <path d="M29.5 22V41" fill="none" stroke={PAPER} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  ),
  // ── Symboles ──
  trophy: () => (
    <>
      <Line d="M18 13H11Q8 13 8 16Q8 27 21 29" color={C.yellow} w={3} />
      <Line d="M46 13H53Q56 13 56 16Q56 27 43 29" color={C.yellow} w={3} />
      <path d="M17 6H47V25Q47 40 32 42Q17 40 17 25Z" fill={C.yellow} {...outline} />
      <polygon points={starPoints(32, 22, 7.5, 3.4)} fill={PAPER} />
      <rect x="27.5" y="41" width="9" height="9" fill={C.orange} {...outline} />
      <rect x="16" y="49" width="32" height="10" rx="3" fill={C.orange} {...outline} />
    </>
  ),
  bolt: () => (
    <>
      <polygon points="37,4 14,36 28,36 24,60 50,26 35,26" fill={C.yellow} {...outline} />
      <path d="M30 14L21 28" fill="none" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  flame: () => (
    <>
      <path d="M32 4C34 14 48 20 48 38C48 50 41 58 32 58C23 58 16 50 16 38C16 30 20 24 24 20C25 26 28 28 30 28C30 18 28 10 32 4Z" fill={C.red} {...outline} />
      <path d="M32 54C26.5 54 23 50.5 23 46C23 40 29 36.5 32 30C35 36.5 41 40 41 46C41 50.5 37.5 54 32 54Z" fill={C.orange} />
      <path d="M32 54C29.2 54 27.5 52 27.5 49.5C27.5 46.5 30.5 45 32 41C33.5 45 36.5 46.5 36.5 49.5C36.5 52 34.8 54 32 54Z" fill={C.yellow} />
    </>
  ),
  target: () => (
    <>
      <circle cx="30" cy="34" r="24" fill={C.red} {...outline} />
      <circle cx="30" cy="34" r="17" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      <circle cx="30" cy="34" r="10" fill={C.red} stroke={INK} strokeWidth="2.6" />
      <circle cx="30" cy="34" r="3.8" fill={C.yellow} stroke={INK} strokeWidth="2.2" />
      <Line d="M31 33L53 11" color={C.brown} w={2.6} />
      <path d="M50 14L51 4L53 7L61 7L56 12L58 20Z" fill={C.blue} {...outline} strokeWidth="2.4" />
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
