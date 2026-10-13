# Semainier : plan technique de la refonte

Statut : décisions 1 à 5 validées par Alexandre le 13/10/2026 (section Décisions).
Le modèle de données (§ 3 et § 4) reste à valider, il n'a pas été tranché par Alexandre.
Entrées : `docs/semainier/01-proposition.md`, ADR 0001, `docs/migrations-prisma.md`,
décisions d'Alexandre du 13/10 (vue composée par le parent, aucune rubrique ni
icône « pipi » ou « sieste », bibliothèque d'images neutres, rappel « pas de
données de santé », consultation dans l'app et saisie par l'assistant).

## Décisions

Validées par Alexandre le 13/10/2026. Elles tranchent les questions 1 à 4 de la
section 10. ADR : `docs/adr/0002-semainier-profil-enfant-rubriques-familiales.md`.

1. **Rubriques définies par le parent.** Libellés au choix, image tirée d'une
   bibliothèque neutre fournie par l'app. L'app ne fournit aucune rubrique, aucun
   libellé ni icône à connotation santé. « Pipi » et « Sieste » disparaissent ; c'est
   l'utilisateur qui interprète (une goutte, par exemple).
2. **Migration du semainier existant.** Les rubriques reprises de « pipi » et
   « sieste » deviennent « Goutte » et « Lune » (Oui / Non), avec un bandeau qui
   invite à les renommer. Elles ne sont masquées que s'il n'y a aucune saisie.
   (Q1, option b.)
3. **Rubrique avec saisies : masquée, jamais supprimée.** Le masquage est réversible.
   (Q2.)
4. **Le semainier appartient au profil enfant, donc au foyer.** Un membre retiré du
   foyer perd l'accès à ce qu'il a rempli. Exception assumée à l'ADR 0001, périmètre
   fixé dans l'ADR 0002. (Q3.)
5. **CGU.** Une page `/cgu` est créée, avec une clause « ne pas saisir de données de
   santé ». Les comptes existants n'ont pas à ré-accepter. (Q4.)

Conséquences pour ce document : les sections 2 et 5 décrivent l'existant ou la cible
telle que validée ci-dessus ; la section 10 est tranchée. Le modèle (§ 3 et § 4)
n'a pas fait l'objet d'une décision d'Alexandre.

## 1. Résumé

Chaque enfant (`FamilyProfile` de type `child`) reçoit ses propres **rubriques**
(`KidTracker`) et leurs **choix** (`KidTrackerOption`), créés par le parent avec
ses libellés et une image tirée d'une bibliothèque neutre. Les saisies d'un jour
restent une ligne `KidDayEntry`, dont les valeurs passent dans une colonne JSON
`values` indexée par rubrique. Une seule bibliothèque serveur (`src/lib/kidTrackers.ts`)
valide et écrit ; l'API et le serveur MCP (qui appelle l'API) l'utilisent.
Migration expand → backfill au démarrage → contract dans un déploiement ultérieur.

## 2. Ce que le code montre aujourd'hui (vérifié)

- `KidDayEntry` : `weather`, `mood`, `nap`, `accident`, `activities` (texte JSON),
  `userId` (auteur), `profileId` (enfant), `@@unique([profileId, date])`.
- `src/app/api/kids/route.ts` : GET (from, to, profileId) et PATCH (upsert du jour),
  contrôle d'accès par `findAccessibleProfile` (`src/lib/profiles.ts`) = membre du
  groupe du profil. Pas de `buildResourceWhere` : le semainier appartient à l'enfant,
  pas à l'utilisateur.
- Auth : `getSessionUser()` accepte aussi `Authorization: Bearer <apiKey>`
  (`src/lib/session.ts`). Le MCP appelle l'API avec cette clé
  (`minddump-mcp/src/client.ts`) : **le contrôle d'accès du MCP est celui de l'API**,
  sans duplication. Les enfants et leur `profileId` sont déjà listés par
  `list_groups` (`minddump-mcp/src/tools/groups.ts`, via `/api/profiles`).
- `src/components/kids/icons.tsx` : 29 SVG inline maison (viewBox 80, couleurs en dur),
  dont `NapYes`, `NapNo`, `DryDay`, `AccidentDay` à supprimer.
- Autres usages : `src/lib/account.ts` (export RGPD : champs legacy ; transfert
  `keepShared` sur `userId`, inchangé), `prisma/backfill-kid-profiles.js` (reprise
  précédente), `src/app/confidentialite/page.tsx` (cite « sieste, accidents »).
- **Aucune page CGU n'existe** dans `src/app/` : elle est à créer.
- Mobile : `mobile/capacitor.config.ts` charge `https://minddump.fr` ; le semainier
  n'utilise aucun plugin natif (pas de `window.Capacitor`, pas de Fullscreen API).
  **Aucun build natif nécessaire.** À vérifier seulement dans le simulateur
  (appui long de sortie, zones sûres, `100dvh`).
- PWA : `/api/kids` n'est pas dans `OFFLINE_API` (`src/app/sw.ts`) ; on garde ce
  choix (pas de saisie hors ligne, comme aujourd'hui).

## 3. Approche retenue et alternatives

| Option | Description | Pour | Contre |
|---|---|---|---|
| A. Tout relationnel | `KidTracker`, `KidTrackerOption`, `KidDayValue` (une ligne par valeur) | Intégrité par clés étrangères ; agrégats SQL | 3 tables ; écriture partielle = delete+insert par rubrique ; unicité impossible à exprimer avec `optionId` nul (compteur) ; backfill plus lourd |
| **B. Config relationnelle + valeurs JSON** (retenue) | `KidTracker` + `KidTrackerOption` ; `KidDayEntry.values Json?` = `{ [trackerId]: string[] (ids d'options) \| number }` | Lecture d'une semaine = 2 requêtes sur 7 lignes ; écriture partielle = fusion dans une ligne ; migration = 2 tables + 1 colonne nullable ; ordre, renommage, masquage simples | Intégrité valeur→option vérifiée en code (un seul endroit) ; fusion à protéger contre les écritures concurrentes |
| C. Tout JSON | config dans `FamilyProfile.kidTrackers`, valeurs JSON | Une colonne | Deux parents qui éditent la vue s'écrasent ; identifiants à générer à la main ; réordonner = réécrire tout ; aucune contrainte |

B est le plus simple qui tienne : volumes minuscules (7 lignes par semaine et par
enfant), agrégats faits en JS, et la configuration, qui elle bouge et se partage
entre membres, garde des lignes propres.

Types de réponse : **`single`** (choix unique), **`multi`** (choix multiples),
**`count`** (compteur 0-99). Le oui/non est un `single` à deux choix dont le parent
choisit libellés et images : pas de 4e type pour un seul cas.

## 4. Modèle de données

```prisma
model KidTracker {
  id          String   @id @default(cuid())
  profileId   String
  profile     FamilyProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  label       String           // saisi par le parent, 1-30 caractères
  icon        String           // identifiant de la bibliothèque (src/lib/kidIconIds.ts)
  kind        String           // "single" | "multi" | "count"
  position    Int      @default(0)
  active      Boolean  @default(true)   // masquée = absente partout, saisies conservées
  legacyKey   String?          // reprise uniquement, supprimé au contract
  createdById String?
  createdBy   User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  options     KidTrackerOption[]
  @@index([profileId, position])
}

model KidTrackerOption {
  id          String   @id @default(cuid())
  trackerId   String
  tracker     KidTracker @relation(fields: [trackerId], references: [id], onDelete: Cascade)
  label       String           // 1-30 caractères
  icon        String
  position    Int      @default(0)
  active      Boolean  @default(true)
  legacyValue String?          // reprise uniquement, supprimé au contract
  @@index([trackerId, position])
}

// KidDayEntry (expand) : + values Json?   (null = ligne pas encore reprise)
```

Limites (dans `kidTrackers.ts`) : 12 rubriques actives par enfant, 16 choix par
rubrique, libellés coupés à 30 caractères, aucun texte libre par jour.

Règles :
- Suppression d'une rubrique ou d'un choix **sans saisie** : suppression réelle.
  **Avec saisies** : masquage seulement (`active=false`), réversible (voir Q2).
- Écriture d'un jour : transaction, `SELECT ... FOR UPDATE` sur la ligne
  `(profileId, date)` (via `$queryRaw`), fusion en JS, `upsert`. Une clé à `null`
  efface la rubrique du jour ; les autres rubriques ne bougent pas.
- Lecture tolérante : si `values` est nul, la valeur est calculée à la volée depuis
  les colonnes legacy (même fonction que le backfill), jusqu'au contract.
- `userId` des entrées n'est jamais modifié (ADR 0001) ; la première saisie crée la
  ligne avec l'auteur courant, comme aujourd'hui.

### Migration (expand) : `prisma/migrations/2026MMDD_kid_trackers/`
Purement additive : 2 tables, 2 index, 1 colonne nullable. Compatible avec le
code précédent pendant le déploiement (il ignore tables et colonne).

### Backfill : `prisma/backfill-kid-trackers.js` (appelé par `entrypoint.sh`, après `backfill-kid-profiles.js`)
Pour chaque profil enfant qui a au moins une `KidDayEntry`, dans une transaction
par profil :
1. Trouver ou créer les rubriques par `legacyKey` (idempotent) :
   `weather` → « Météo » (`sun`, single, 6 choix), `mood` → « Humeur »
   (`face-happy`, single, 5 choix), `activities` → « Activités » (`star`, multi,
   12 choix), et les deux rubriques reprises de `nap` et `accident` (libellés selon
   Q1), en `single` à deux choix. Libellés des choix : ceux affichés aujourd'hui
   (Soleil, Content, Peinture…). Une rubrique reprise sans aucune valeur chez cet
   enfant est créée masquée.
2. Convertir les lignes `values IS NULL` : chaque colonne non nulle devient une
   clé de `values` ; une ligne entièrement vide reçoit `{}`.
3. Journal : nombre de profils, de rubriques créées, de lignes converties.
   Sans effet une fois tout converti ; en cas d'erreur, log et sortie sans bloquer
   (même convention que les autres backfills).

Correspondance des images (identifiants neutres) :
sunny→`sun`, partly-cloudy→`sun-cloud`, cloudy→`cloud`, rainy→`rain`,
stormy→`storm`, snowy→`snow` ; very-happy→`face-very-happy`, happy→`face-happy`,
neutral→`face-neutral`, sad→`face-sad`, angry→`face-angry` ; painting→`brush`,
reading→`book`, sport→`ball`, music→`music`, puzzle→`puzzle`, park→`tree`,
cooking→`pan`, swimming→`wave`, friends→`people`, crafts→`scissors`,
animals→`paw`, dressup→`mask` ; reprise de `nap` → `moon` (choix `moon` / `sun`),
reprise de `accident` → `drop` (choix `drop` / `sun`).

Fenêtre de déploiement : l'ancien conteneur sert encore pendant le démarrage du
nouveau. Une saisie qu'il crée après le backfill a `values` nul : lue à la volée,
puis convertie au démarrage suivant. Seule une modification par l'ancien code d'une
ligne déjà convertie serait perdue (fenêtre de quelques dizaines de secondes) :
déployer à une heure creuse.

### Contract (déploiement ultérieur, au moins une semaine après)
Préalable, en lecture sur la prod :
`SELECT count(*) FROM "KidDayEntry" WHERE "values" IS NULL;` doit être 0.
Puis migration qui supprime `weather`, `mood`, `nap`, `accident`, `activities`,
`legacyKey`, `legacyValue` ; suppression du script de backfill et de sa ligne dans
`entrypoint.sh` ; suppression de la lecture tolérante. Sauvegarde `pg_dump`
automatique avant migration (entrypoint).

### Impact ADR 0001
- Aucune entrée supprimée ni réattribuée ; tout ce qu'un parent voyait reste visible
  (rubriques reprises, choix repris, mêmes libellés pour météo, humeur, activités).
- Le semainier appartient au **profil enfant**, donc au groupe : un membre retiré du
  groupe perd l'accès à ce qu'il y a saisi, et la suppression du groupe ou du profil
  supprime le semainier (cascade). C'est déjà le cas aujourd'hui (`docs/rgpd.md`),
  mais c'est une exception à 0001 jamais écrite : à acter (Q3, ADR 0002).

## 5. Interfaces

### Bibliothèque partagée
- `src/lib/kidIconIds.ts` (données pures, importable client, serveur, sans React) :
  liste des identifiants et libellé accessible neutre de chacun.
- `src/lib/kidTrackers.ts` (serveur uniquement, `import "server-only"`) :
  `loadTrackers(profileId, {includeInactive})`, `validateTrackerInput`,
  `validateDayPatch(trackers, patch)` (accepte id **ou** libellé normalisé, sans
  casse ni accents ; erreur = liste des valeurs acceptées), `writeDay` (fusion
  verrouillée), `legacyToValues` (backfill et lecture tolérante), contrôle d'accès
  via `findAccessibleProfile`.
- `src/lib/kidWeek.ts` (pur) : types, `summarizeWeek` (ligne de bilan F1 :
  « 4 jours sur 5 remplis », « le plus fréquent : Parc »), réutilisé par l'API pour
  le MCP.

### API (toutes : session ou clé API, `findAccessibleProfile`, 404 sinon)
| Méthode | Route | Corps / paramètres |
|---|---|---|
| GET | `/api/kids/trackers?profileId=&all=1` | rubriques + choix (actives seulement sans `all`) |
| POST | `/api/kids/trackers` | `{ profileId, label, icon, kind, options:[{label, icon}] }` |
| PATCH | `/api/kids/trackers/[id]` | `{ label?, icon?, active?, options?:[{id?, label, icon, active?}] }` (ordre des choix = ordre du tableau) |
| DELETE | `/api/kids/trackers/[id]` | supprime si aucune saisie, sinon 409 « masquer » |
| PUT | `/api/kids/trackers/order` | `{ profileId, ids:[...] }` |
| GET | `/api/kids/week?profileId=&from=&to=` | `{ trackers, days:[{date, values}], summary }`, 31 jours maximum |
| PATCH | `/api/kids/day` | `{ profileId, date, values:{ [trackerId\|libellé]: string[] \| number \| null } }` ; refuse une rubrique masquée |

Ancienne route `/api/kids` : GET conservé jusqu'au contract (onglets PWA ouverts sur
l'ancienne version) ; PATCH renvoie 409 « Nouvelle version, recharge la page »
pour qu'aucune saisie n'aille dans les colonnes legacy. Supprimée au contract.

### MCP (`minddump-mcp/src/tools/kids.ts`, enregistré dans `src/index.ts`)
- `kids_list_trackers(child, includeHidden?)` : rubriques actives, type, choix (libellés).
- `kids_read_week(child, date?)` : semaine (lundi au dimanche) contenant `date`, semaine
  en cours par défaut (Europe/Paris) ; valeurs en libellés, plus le bilan de l'API.
- `kids_fill_day(child, date?, values)` : écriture partielle, rubriques et choix par
  libellé (casse et accents ignorés), `null` efface ; les erreurs de l'API (valeur
  inconnue avec liste acceptée, rubrique masquée, profil inaccessible) remontent telles
  quelles.
- Écart assumé avec la première version du plan (`list_kid_trackers`, `get_kid_week`,
  `set_kid_day`, `profileId`, `from`/`to`) : préfixe `kids_` pour regrouper les trois
  outils, et `child` accepte le prénom (comme `list_groups` le montre) ou l'id, plus
  simple pour l'assistant. Les autres outils du MCP n'ont pas de préfixe de module
  (`verbe_nom`), donc ce préfixe est propre au semainier. La semaine se choisit par un
  jour, pas par `from`/`to` (l'API garde la limite de 31 jours).
- Libellés = données : tout libellé saisi par la famille (rubriques, choix, prénoms,
  lignes du bilan, messages d'erreur) est renvoyé entre guillemets, sans `* _ \` # [ ] < >`
  ni retour à la ligne, borné à 80 caractères ; chaque description d'outil précise que
  ce sont des données, jamais des instructions (retour secops, test `npm run test:kids`).
La création ou modification de rubriques par l'assistant est hors MVP (les routes
existent ; un outil pourra s'y brancher plus tard).

### Interface (`src/app/kids/`)
- Vue semaine parent : `module-hero` compact, tableau rubriques × 7 jours en aplats
  (tokens `tone`), libellé de rubrique au-dessus de chaque ligne pour tenir en 375 px,
  aujourd'hui repéré par texte et contour, cases vides visibles, ligne de bilan.
  Rafraîchissement au retour sur la page (`visibilitychange`) pour voir les saisies
  de l'assistant. Remplace les cartes et `KidsStats.tsx`.
- Éditeur du jour : ouvert sur la rubrique touchée.
- Éditeur de vue (parent) : créer, renommer, choisir l'image (grille de la
  bibliothèque), choisir le type, ajouter des choix, réordonner (boutons haut/bas,
  pas de glisser-déposer pour l'instant), masquer. **Rappel visible dans le dialogue
  de création** : « N'y note pas de données de santé. » avec lien vers `/cgu`.
  Nouvel enfant : état vide qui invite à créer une rubrique, aucune proposée.
- Mode enfant plein écran : grands boutons libellés, semaine en cours, règles
  conservées (ré-appui ne désélectionne pas, fond ne ferme pas, sortie par appui
  long) ; compteur = gros boutons + et −.

### Bibliothèque d'images
- Format : composants SVG inline (pattern actuel), registre `KID_ICONS[id]` dans
  `src/components/kids/icons.tsx`, chargé seulement sur `/kids`. Couleurs par
  variables CSS pour les thèmes clair et sombre. Sprite écarté : thème plus
  difficile, gain nul à cette taille (83 icônes, une quinzaine de Ko gzip).
- Origine : dessin maison, comme les 29 icônes actuelles (historique git du
  fichier). Si un tracé externe est repris : Lucide (ISC) ou Tabler (MIT)
  seulement, mention dans un `NOTICE` ; pas de CC BY-SA ni de pack non libre.
- 40 identifiants d'origine, figés (déjà en base : jamais renommés ni réordonnés) :
  `sun, sun-cloud, cloud, rain, storm, snow, moon, star, rainbow, drop, leaf,
  flower, tree, face-very-happy, face-happy, face-neutral, face-sad, face-angry,
  brush, book, ball, music, puzzle, pan, wave, people, scissors, paw, mask, bike,
  car, house, backpack, cake, heart, cup, check, cross, bell, gift`.
- Extension à 83 : 43 identifiants ajoutés en fin de `src/lib/kidIconIds.ts`
  (nourriture, animaux, lieux, transports, jeux et objets, symboles), mêmes
  règles de neutralité. La liste du code fait foi ; rien ne fige le nombre en dur
  (l'API renvoie la liste acceptée, le test la lit dans la source).
- Exclus : tout objet médical ou corporel (pilule, thermomètre, seringue,
  pansement, toilettes, pot, couche, biberon, partie du corps). Libellés
  accessibles purement descriptifs (« goutte », « lune »).

## 6. Lots

| Lot | Agent | Fichiers | Dépend de | Preuve attendue |
|---|---|---|---|---|
| **L1 Données et API** | data-guardian | `prisma/schema.prisma`, `prisma/migrations/<ts>_kid_trackers/`, `prisma/backfill-kid-trackers.js`, `entrypoint.sh`, `src/lib/kidIconIds.ts`, `src/lib/kidTrackers.ts`, `src/lib/kidWeek.ts`, `src/app/api/kids/**`, `src/lib/account.ts` (export : rubriques + valeurs lisibles), `tests/ownership.test.mjs` | réponses Q1 à Q3 | Migration + backfill joués sur une base restaurée d'un dump au schéma de prod : nombre d'entrées identique, chaque valeur legacy non nulle retrouvée dans `values`, 2e démarrage sans effet ; `npm run build && npm run test:ownership` vert avec un scénario semainier (membre lit et écrit, non-membre 404 sur toutes les routes, membre retiré selon Q3, clé API = mêmes droits) |
| **L2 Bibliothèque d'images** | uiux | `src/components/kids/icons.tsx` | liste d'identifiants ci-dessus (pas de L1) | Planche des 40 icônes en clair et sombre ; `grep -riE "nap\|accident\|dry\|pipi\|sieste\|pee\|potty\|pill\|thermo\|syring" src/components/kids` vide |
| **L3 Interface** | uiux | `src/app/kids/*` (`KidsWeekly.tsx` découpé : vue semaine, éditeur du jour, éditeur de vue, mode enfant ; `KidsStats.tsx` supprimé), styles `kids-*` de `src/app/globals.css` | L1 (contrat API), L2 | Playwright : 375 px sans défilement horizontal, rappel santé visible à la création, lecteur d'écran « mardi, Humeur : Content », règles du mode enfant, enfant migré affiche les mêmes données qu'avant |
| **L4 MCP** | integrations | `minddump-mcp/src/tools/kids.ts`, `minddump-mcp/src/index.ts`, `minddump-mcp/README.md` | L1 (API locale suffit) | Appels réels contre l'app locale avec une clé API : lecture, écriture partielle sans toucher les autres rubriques, valeur inconnue refusée avec liste, profil d'un autre foyer refusé, 32 jours refusés ; saisie visible dans l'app au retour sur la page |
| **L5 Pages légales** | seo | nouveau `src/app/cgu/page.tsx`, `src/app/confidentialite/page.tsx` (paragraphe Semainier réécrit : rubriques libres, pas de données de santé, accès par l'assistant), `src/app/sitemap.ts`, liens depuis pied de page et inscription | Q4 | Pages rendues, liens valides, plus aucune mention « sieste » ni « accidents » ; texte relu par Alexandre |
| **L6 Docs et ADR** | docs | `docs/adr/0002-*.md`, `docs/rgpd.md`, `docs/semainier/`, `docs/backlog.md` (F4 à F8) | Q1 à Q3 | ADR indexé ; `docs/rgpd.md` cohérent avec la page confidentialité |
| **L7 Vérification mobile** | mobile (lecture et test) | aucun fichier, sauf correctif CSS délégué à uiux | L3 déployé en local | Simulateur iOS et Android sur serveur local (`MINDDUMP_URL`) : mode enfant, appui long, zones sûres ; confirmation qu'aucun build natif n'est requis |
| **L8 Contract** | data-guardian | migration de suppression, `prisma/backfill-kid-trackers.js` (supprimé), `entrypoint.sh`, `src/lib/kidTrackers.ts`, `src/app/api/kids/route.ts` (supprimé), `src/lib/account.ts` | L1-L3 en prod depuis au moins une semaine | Requête préalable = 0 ; build + `test:ownership` vert ; migration rejouée sur dump de prod |

Parallélisme (un worktree et une base de test par agent) : **L1, L2, L5 et L6
(brouillon) démarrent ensemble**, sans zone commune. L3 commence dès que le
contrat d'API de L1 est figé (ce document) et branche les vraies routes ensuite.
L4 démarre quand L1 est fusionné. L7 après L3. Zones exclusives : `src/lib/kid*`,
`src/app/api/kids`, `prisma/`, `entrypoint.sh`, `tests/` à data-guardian ;
`src/components/kids`, `src/app/kids`, `globals.css` à uiux ; `minddump-mcp/` à
integrations ; `src/app/cgu`, `src/app/confidentialite`, `sitemap.ts` à seo ;
`docs/` à docs.

## 7. Ordre de déploiement

1. **App** (L1 + L2 + L3 + L5 dans le même déploiement Coolify, heure creuse) :
   sauvegarde et migration expand au démarrage, backfill, puis serveur. Le stage
   `test` (`test:ownership`) bloque si l'accès régresse.
2. **Serveur MCP** (L4), redeploy séparé, une fois l'app en ligne (sinon les
   outils appellent des routes absentes).
3. **Mobile** : aucun build ; vérification L7 sur minddump.fr après déploiement.
4. **Contract** (L8) : déploiement distinct, au moins une semaine plus tard.

## 8. Risques et points ouverts

- **Saisies concurrentes** (assistant et parent sur le même jour) : verrou de ligne
  dans `writeDay` ; à couvrir par un test d'écriture parallèle dans L1.
- **Onglets PWA restés sur l'ancienne version** : PATCH legacy en 409, message de
  rechargement ; aucune saisie silencieusement perdue.
- **Fenêtre de déploiement** (ancien conteneur actif) : voir § 4, risque résiduel
  faible, heure creuse.
- **Libellés libres** : l'utilisateur peut quand même créer « Médicaments ».
  L'app ne filtre pas le texte (pas de liste de mots interdits, contournable et
  vexante) ; la protection est le rappel à la création, les CGU et l'absence de
  tout libellé ou icône santé fournis. Avis juridique toujours recommandé avant
  ouverture large et soumission aux stores.
- **Charge de dessin** : 40 icônes en style aplats, c'est le poste le plus long de
  L2 ; réutiliser et aplatir les 25 icônes existantes conservées.
- **Écran étroit** : 12 rubriques × 7 jours tiennent en hauteur (défilement
  vertical) mais pas en largeur si le libellé reste en colonne : libellé au-dessus
  de la ligne, imposé par la maquette L3.
- **Exception à ADR 0001** non écrite (semainier rattaché à l'enfant et au
  groupe) : Q3.

## 9. ADR à rédiger

Oui : **ADR 0002 — Le semainier appartient au profil enfant ; ses rubriques sont
définies par la famille, sans catégorie de santé fournie par l'app.** Contenu :
rattachement au profil (exception à 0001 et ses conséquences), modèle B (config
relationnelle + valeurs JSON), bibliothèque d'images neutres et liste d'exclusions,
règle « masquer plutôt que supprimer » quand des saisies existent.

## 10. Questions pour Alexandre

Tranchées le 13/10/2026 : voir la section Décisions (Q1 à Q4).

1. **Libellés des rubriques reprises de « pipi » et « sieste »** (enfants qui en
   ont des saisies) :
   a) la migration recopie une fois les libellés actuels, considérés ensuite comme
      ceux de l'utilisateur (le plus fidèle pour lui, mais ces mots restent dans le
      script de reprise jusqu'au contract et dans ses données) ;
   b) libellés neutres « Goutte » et « Lune », choix « Oui » / « Non », images
      `drop` et `moon`, avec un bandeau unique « Deux rubriques ont été renommées,
      donne-leur le nom que tu veux » ;
   c) comme b) mais rubriques masquées d'office (données conservées, réactivables).
   **Recommandation : b)**, rubrique masquée seulement si l'enfant n'y a aucune
   saisie. a) contredit la décision 2 ; c) fait disparaître de l'écran ce que le
   parent voyait, contraire à l'esprit de 0001.
2. **Supprimer une rubrique qui a des saisies** : masquage seul, réversible
   (recommandé), ou suppression définitive après confirmation explicite ?
3. **Membre retiré du groupe** : il perd l'accès au semainier qu'il a rempli
   (comportement actuel, l'enfant appartient au groupe). On l'acte comme exception
   à 0001 dans l'ADR 0002 (recommandé), ou on veut qu'il garde une lecture de ses
   saisies ?
4. **CGU** : la page n'existe pas. On crée `/cgu` (texte court, rédigé par seo/docs,
   relu par toi) liée depuis l'inscription et le pied de page, sans faire
   ré-accepter les comptes existants (recommandé) ? Ou acceptation explicite
   demandée à tous ?
