# Landing v2 : « l'atelier du foyer »

Proposition de refonte de la landing (`src/components/landing/`). Elle remplace
l'ancienne sur la branche `feat/landing-v2` ; l'ancienne reste dans git. À
valider sur captures et vidéo avant tout push.

## Concept

La charge mentale est un brouillon : des bouts de papier dans la tête. MindDump
les range. Toute la page joue ce passage du **chaos à l'atelier rangé**, avec un
ton d'agence (très gros titres, aplats francs, mouvement scénarisé) et une seule
couleur forte.

- **Palette** : papier chaud (`#FAF8F4`), encre profonde (`#14181F`), orange
  `#F97316` en aplat (fond de boutons, texte en encre dessus : 6,9:1). L'orange
  vif n'est jamais utilisé en texte sur clair ; le texte orange utilise un
  orange foncé (6,9:1).
- **Typographie** : Plus Jakarta Sans (celle de l'app) poussée en 800, serrée.
  Caveat uniquement pour les notes de la section « chaos », comme avant. Aucune
  écriture manuscrite ailleurs.
- **Pas de thème sombre** : la landing reste claire, comme l'ancienne ; les
  sections sombres sont des blocs d'encre de la composition, pas un thème.

## Structure

| # | Section | Rôle | Animation |
|---|---|---|---|
| 0 | En-tête collant | Ancres + « Créer mon espace » | Fond flouté après 16 px de défilement |
| 1 | Hero : « Vide ta charge mentale. » | Reconnaître, proposer, agir | Titre mot à mot (CSS, flou vers net), soulignement dessiné, téléphone et cartes flottantes, parallaxe |
| 2 | Bandeau | « Il se branche sur ce que tu utilises déjà » (HelloFresh, Jow, Quitoque, Google/Apple Agenda, drives en ligne, Claude), texte seul, pas de logos | Défilement continu, pausé au survol |
| 3 | Chaos → ordre | Le problème, raconté par l'image | Scrub GSAP : des notes manuscrites éparpillées se rangent dans Tâches / Courses & repas / Agenda |
| 4 | Quatre scènes empilées | Preuves : recette → courses → panier drive ; agenda et tâches du foyer ; assistant (Claude via MCP) ; écran mural, mode enfant, rappels | Cartes `sticky` qui se recouvrent, maquettes d'interface codées qui jouent leur séquence en entrant à l'écran |
| 5 | « À la carte » | Le reste, sans rien imposer (modules, iCal, météo, rappels, partage, connexion) | Cartes à halo qui suit le pointeur (React Bits) |
| 6 | Appel final + guides | « Arrête d'être le seul cerveau du foyer. » vers `/register` | Dégradé orange qui dérive ; liens vers les guides (maillage interne) |

## Copy

Tutoiement, bénéfice avant fonction (« la recette du matin est déjà dans ta
liste de courses »). Rien que le code ne fasse : l'assistant passe par Claude ou
un client MCP (l'app n'a pas d'appareil photo, c'est dit dans la scène 3) ;
aucun chiffre d'usage, témoignage, logo client ni promesse de prix. Les
maquettes sont légendées « Interface de l'app, données d'exemple ». Les noms de
services (HelloFresh, Jow, Quitoque, Google, Apple, Claude) désignent des
intégrations réelles, en texte seul.

## Technique

- Page rendue côté serveur : tout le texte est dans le HTML (h1 « Vide ta
  charge mentale. », h2 par section). Canonique `/`, métadonnées et
  `test:seo` inchangés. `/` connectée affiche toujours le Dashboard.
- **L'état par défaut du HTML est l'état final.** Sans JavaScript ou avec
  `prefers-reduced-motion`, la page est complète et statique (chaos déjà rangé,
  cartes empilées sans recouvrement animé).
- Seuls deux composants sont clients : `LandingMotion` et `SpotlightCard`.
  GSAP, ScrollTrigger et Lenis sont chargés dans un chunk séparé, en différé
  (`requestIdleCallback`), après le premier écran. Le hero n'utilise que du CSS.
- La landing défile dans son propre conteneur fixe (le layout de l'app enferme
  `main` dans un viewport fixe) : GSAP utilise `scroller`, Lenis `wrapper`.
- Mouvement : `transform`, `opacity` et `filter` seulement.

## Composants et dépendances

- **React Bits `SpotlightCard`** (TS + Tailwind, sans dépendance), licence MIT
  + Commons Clause : usage dans une application ou un site autorisé, revente du
  composant seul interdite. Copié tel quel dans `SpotlightCard.tsx`
  (source : https://reactbits.dev/r/SpotlightCard-TS-TW.json), 9 Ko non minifiés.
- **Inspiré de React Bits `BlurText`** : réimplémenté en CSS pur (classe
  `.lp2-w`) plutôt que d'ajouter `motion` (~30 Ko) pour un effet qui n'a pas
  besoin de JavaScript, et pour que le titre soit peint dès le premier frame.
- **`gsap`** (core + ScrollTrigger, ~27 Ko gzip) et **`lenis`** (~4 Ko gzip),
  chargés en différé. Justification : le scrub du chaos et l'empilement des
  scènes ne sont pas faisables proprement avec `motion` dans un conteneur de
  défilement personnalisé. Lenis est limité à la landing (jamais dans l'app ni
  la coque native, qui ne montre pas la landing).

## À valider

- Disponibilité réelle des apps iPhone et Android sur les stores avant d'y
  renvoyer explicitement (la page parle de « rappels sur iPhone et Android » et
  d'« installable sur l'écran d'accueil », sans badge de store).
- « Connecteurs aux drives en ligne » : formulation générique demandée par Alexandre (pas de nom d enseigne)
  comme publié.
- Intérêt d'ajouter des données structurées (`SoftwareApplication`) : écarté
  tant que le modèle économique n'est pas tranché.
