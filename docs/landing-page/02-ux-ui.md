# MindDump — Analyse UX/UI de la landing page

Plan de conception. S'appuie sur [`01-marketing.md`](./01-marketing.md).

**Contrainte directrice :** la page doit impressionner techniquement. Les actions déclenchées au scroll font défiler en animation l'explication de MindDump. L'animation n'est pas décorative — elle *est* la démonstration.

---

## 1. Architecture narrative

La page raconte un arc en trois temps : **le chaos → la mise en ordre → la vie d'après**. Chaque section a un rôle dramatique, pas seulement un contenu.

| # | Section | Ce que le visiteur doit ressentir | Ce qu'il doit comprendre |
|---|---|---|---|
| 0 | **Header sticky** | « je peux entrer quand je veux » | Où se connecter |
| 1 | **Hero** | Reconnaissance immédiate | MindDump vide la charge mentale — et une IA la remplit à ta place |
| 2 | **Le chaos** | « c'est exactement ma tête » | Le problème est nommé, précisément |
| 3 | **La boucle** | « attends, c'est *tout* ce qu'il y a à faire ? » | Recette → courses en un geste |
| 4 | **L'assistant IA** ★ | « donc je n'ai littéralement rien à saisir » | Une photo suffit — page de recette, ou intérieur du frigo |
| 5 | **Les modules** | Étendue, complétude | 5 domaines, activables à la carte, semainier compris |
| 6 | **Le foyer** | « ma famille pourrait suivre » | Partage par lien, données communes |
| 7 | **CTA final** | Décision | Créer un compte, ou se connecter |

★ = pièce maîtresse.

---

## 2. Scénographie des animations

### Principe transversal

Trois familles d'animation, jamais mélangées dans une même section :

- **Reveal** — déclenché une fois, au franchissement d'un seuil (IntersectionObserver). Pour les contenus.
- **Scrub** — l'avancement du scroll pilote directement la progression d'une animation. Pour les démonstrations.
- **Parallaxe** — décalage continu, subtil, sur les éléments de décor uniquement.

### Section 1 — Hero : entrée séquencée

Au chargement, pas au scroll. Cascade de 5 temps, décalés de 90 ms :

1. Badge IA (« Photographie ton frigo, l'IA s'occupe du dîner ») — fade + montée 12 px
2. H1 « Vide ta charge mentale » — fade + montée 20 px
3. Sous-titre — fade + montée 16 px
4. Double CTA — fade + montée 12 px
5. Aperçu de l'app — fade + montée 40 px + `scale(0.96 → 1)`

**Décor :** 6 à 8 notes manuscrites (police Caveat) flottant en arrière-plan — « rdv pédiatre », « acheter du pain », « relancer le plombier ». Dérive lente et continue, amplitudes et durées désynchronisées. Elles matérialisent la charge mentale *avant* qu'on la nomme.

**Indicateur de scroll** en bas : une ligne verticale animée. Signal explicite que la page se lit en descendant.

### Section 2 — Le chaos : de la dispersion à l'ordre

L'animation *est* l'argument. Deux états pilotés par le scroll (scrub) :

- **Progression 0 → 0,55** — 9 notes dispersées, rotations aléatoires (−12° à +12°), positions éclatées. Le titre « Ça, c'est une semaine dans ta tête » est visible.
- **Progression 0,55 → 1** — les notes convergent vers une pile ordonnée : rotation → 0°, positions → grille alignée, opacité des notes secondaires ↓. Le second titre « MindDump la range. » prend le relais par cross-fade.

Techniquement : chaque note interpole sa transform entre deux jeux de coordonnées via une seule valeur de progression. Aucun reflow — uniquement `transform` et `opacity`.

### Section 3 — La boucle (scroll-driven)

**Section haute (300 vh) en `position: sticky`.** Le visuel reste fixe pendant que le scroll pilote une démonstration en 4 phases.

| Progression | Phase | Ce qui se passe à l'écran |
|---|---|---|
| 0 → 0,25 | **Repérer** | Trois cartes sources (HelloFresh, Jow, Quitoque) montent en cascade. Une se surligne. |
| 0,25 → 0,50 | **Importer** | La carte source se transforme en fiche recette : titre, temps, portions. Une barre de progression d'import se remplit. |
| 0,50 → 0,75 | **Extraire** | Les 6 ingrédients apparaissent un par un, en cascade indexée sur la progression. |
| 0,75 → 1 | **Cocher** | Les ingrédients glissent vers une liste de courses à droite ; les cases se cochent en séquence ; la barre de progression atteint 100 %. |

Un **indicateur d'étapes** (4 pastilles) s'illumine au fil des phases : le visiteur sait toujours où il en est, et que le scroll pilote quelque chose.

**Pourquoi ça sert le message :** l'utilisateur *fait* le geste avec son doigt. Il ne lit pas « on génère la liste automatiquement » — il la voit se remplir sous son scroll. C'est la traduction littérale du bénéfice n°2 de l'analyse marketing.

### Section 4 — L'assistant IA ★ (pièce maîtresse)

Trois preuves, de la plus spectaculaire à la plus sobre.

**Deux scénarios photo**, alternés gauche/droite, chacun déclenché au reveal :

1. Un **cadre de visée** (coins orange) contenant une illustration CSS — une page de recette imprimée, puis l'intérieur d'un frigo.
2. Une **ligne de scan** orange balaie le cadre de haut en bas (1,6 s) : c'est le geste de reconnaissance, rendu visible.
3. Les **éléments reconnus** apparaissent en pastilles, en cascade indexée (110 ms d'écart) — « Courgette », « Œufs », « Feta »…
4. La **fiche résultante** monte : titre, méta, et la confirmation verte « Ajoutée à ton catalogue » / « Ajoutée à tes repas planifiés ».

**Puis le terminal MCP**, en clôture : une phrase se tape caractère par caractère, la réponse suit. Registre volontairement sobre après deux démonstrations visuelles.

**Pourquoi ça sert le message :** l'objection principale d'une app d'organisation est « encore une app à remplir ». Ces deux scénarios y répondent frontalement — le contenu entre sans saisie. Le frigo va plus loin que l'import : il crée de la valeur là où l'utilisateur n'avait rien à importer du tout.

**Honnêteté visuelle :** les illustrations sont des dessins CSS assumés, jamais de fausses photos ni de captures truquées. La page dit explicitement que le geste passe par un assistant compatible MCP, pas par une caméra intégrée à l'app.

### Section 5 — Les modules : révélation en cascade

Grille de 5 cartes (le semainier y figure comme un module parmi d'autres, sans section dédiée). Chacune se révèle au franchissement du seuil, avec un délai indexé sur sa position (`index * 80 ms`) : fade + montée 24 px + `scale(0.97 → 1)`.

Au survol : élévation de l'ombre, translation −4 px, icône qui pivote légèrement. Discret — conforme à la préférence du projet pour des interactions sobres.

### Section 6 — Le foyer

Reveal latéral sur écran large : le texte entre par la gauche (−32 px), le visuel par la droite (+32 px). Sous 640 px l'offset devient vertical, sinon il élargirait la page au-delà du viewport. Le visuel montre trois avatars rejoignant un cercle commun, avec un lien d'invitation qui se « copie » en boucle.

### Section 7 — CTA final

Fond en dégradé orange. Le bloc monte de 24 px au reveal. Double bouton : **Créer un compte** (plein) et **Se connecter** (fantôme).

---

## 3. Système de design

Aligné sur les tokens existants de `globals.css` — la landing ne doit pas paraître greffée.

| Rôle | Valeur | Origine |
|---|---|---|
| Fond | `hsl(40 20% 97%)` — blanc cassé chaud | token `--background` |
| Fond alterné | `hsl(220 14% 98%)` | dérivé, sépare les sections |
| Texte | `hsl(220 20% 14%)` — navy | token `--foreground` |
| Accent | `hsl(24 85% 53%)` — orange | token `--primary` |
| Bordures | `hsl(220 13% 91%)` | token `--border` |
| Vert validation | `hsl(142 60% 45%)` | repris des listes de courses |
| Rayon | `0.75rem` (cartes) / `1.5rem` (blocs) | token `--radius` |

**Typographie :**
- **Inter** — texte et titres. H1 en `clamp(2.5rem, 7vw, 5rem)`, poids 700, `letter-spacing: -0.03em`, `line-height: 1.05`.
- **Caveat** — manuscrite, réservée aux notes de charge mentale. Elle porte tout le registre émotionnel de la page ; ne jamais l'utiliser ailleurs.

**Espacement :** rythme vertical de 8 px. Sections en `py-24` mobile / `py-32` desktop.

**Ombres :** trois niveaux seulement — `0 1px 3px rgba(0,0,0,.04)` (repos), `0 8px 30px rgba(0,0,0,.06)` (carte élevée), `0 20px 60px rgba(0,0,0,.10)` (mockup héros).

---

## 4. Responsive

Mobile-first. Testé mentalement de 375 px à 2560 px.

| Section | Adaptation mobile | Principe |
|---|---|---|
| Hero | H1 en `clamp()`, CTA empilés pleine largeur, notes flottantes réduites à 4 et repoussées aux marges | Le texte ne doit jamais concurrencer le décor |
| Le chaos | Grille de notes 3×3 → 2 colonnes, amplitude de dispersion réduite | L'effet de convergence reste lisible |
| **La boucle** | Le sticky passe de 300 vh à 260 vh ; recette et liste s'empilent verticalement au lieu de côte à côte ; le mouvement latéral devient vertical | **L'animation est conservée, pas supprimée** — c'est l'argument principal de la page |
| Modules | 3 colonnes → 1 | — |
| Le foyer | Côte à côte → empilé, visuel en second. Les décalages de révélation passent de latéraux à verticaux | Un offset latéral élargirait la page au-delà du viewport |
| **Assistant IA** | Cadre de visée et texte s'empilent ; le cadre garde son ratio 4/3 et les pastilles passent sur plusieurs lignes | Le scan et la cascade sont conservés à l'identique |

**Règle :** aucune animation n'est retirée sur mobile. Les amplitudes sont réduites, les axes réorientés — le mobile n'est pas une version amputée.

---

## 5. Accessibilité et performance

### `prefers-reduced-motion`

Obligatoire. Le hook `useReducedMotion` court-circuite toute la mécanique :

- Les éléments à révéler sont rendus **immédiatement visibles** (`opacity: 1`, `transform: none`) — jamais bloqués dans leur état initial.
- Les valeurs de scrub sont figées à leur état final : la liste de courses est affichée **remplie**, la recette importée. Le contenu est intégralement compréhensible sans mouvement.
- Les dérives de décor et le terminal qui se tape sont désactivés.

Doublé d'une garde CSS (`@media (prefers-reduced-motion: reduce)`) qui neutralise transitions et animations, au cas où le JS n'aurait pas encore pris la main.

### Performance

- Animations sur **`transform` et `opacity` uniquement**. Aucune propriété déclenchant un layout.
- Scroll lu dans une boucle `requestAnimationFrame` avec drapeau `ticking` — un seul recalcul par frame, jamais de travail dans le handler de scroll.
- Écriture directe des variables CSS sur les nœuds (`style.setProperty('--p', …)`) plutôt que via l'état React : le scrub ne provoque **aucun re-render**.
- `will-change: transform` posé uniquement sur les éléments scrubés, retiré ailleurs.
- Listeners `{ passive: true }`.
- Aucune dépendance d'animation ajoutée : ni GSAP, ni Framer Motion. `package.json` n'en contient aucune, et l'effet est atteignable en CSS + IntersectionObserver + rAF.

### Sémantique

- Un seul `<h1>`, hiérarchie `h2`/`h3` respectée ensuite.
- Décor purement visuel en `aria-hidden="true"`.
- Contraste : navy sur blanc cassé ≈ 14:1 ; blanc sur orange ≈ 3,3:1 → réservé aux textes ≥ 18 px en gras (conforme AA large text).
- Navigation clavier : focus visible sur tous les CTA.

---

## 6. Intégration technique

### Routage

`/` devient public et arbitre :

- **Session active** → dashboard inchangé (déplacé tel quel dans `src/components/Dashboard.tsx`)
- **Pas de session** → landing page
- **Chargement** → écran neutre

`"/"` est retiré du matcher de `src/middleware.ts` ; toutes les autres routes restent protégées. Le dashboard n'est pas modifié fonctionnellement — uniquement déplacé.

### Connexion

Le bouton de connexion pointe vers `/login`, le flux d'authentification réel du projet (next-auth, provider `credentials`). Aucun CTA décoratif : **Se connecter** → `/login`, **Créer un compte** → `/register`.

### Contournement du layout applicatif

Le layout racine impose `flex h-screen overflow-hidden` avec un `<main>` qui a son propre scroll et du padding. La landing s'en extrait via un conteneur `fixed inset-0 overflow-y-auto` :

- elle occupe le viewport entier, sans le padding de l'app ;
- **ce conteneur devient la source de scroll** — il sert de `root` aux IntersectionObserver et de référence pour le scrub (`scrollTop`), et non `window` ;
- la `Navbar` retourne déjà `null` hors session, donc aucun conflit visuel.

C'est la raison pour laquelle les hooks prennent une `ref` de conteneur en paramètre plutôt que de lire `window.scrollY`.
