# ADR 0002 — Le semainier appartient au profil enfant ; la famille définit ses rubriques

- Statut : accepté
- Date : 2026-10-13
- Exception à : [ADR 0001](0001-les-elements-restent-attaches-a-leur-auteur.md), périmètre limité ci-dessous

## Contexte

Le semainier saisit, pour chaque enfant et chaque jour, cinq rubriques fixes :
météo, humeur, pipi (au sec ou accident), sieste et activités. Les rubriques
« pipi » et « sieste » touchent à l'intime et au sommeil, et ne valent pas pour
tous les âges. Par ailleurs, l'assistant doit pouvoir lire et saisir le
semainier (outils MCP), et l'app ne doit pas se présenter comme un outil de
santé (`docs/semainier/01-proposition.md`, section Risques).

L'ADR 0001 rattache chaque élément à son auteur. Un semainier rattaché à son
auteur serait une copie par parent, et il disparaîtrait pour les autres membres
quand un parent quitte le foyer.

## Décision

1. **Le semainier appartient au profil enfant** (`FamilyProfile` de type `child`),
   donc au groupe. Tout membre du groupe le lit et le remplit.
2. **La famille définit les rubriques.** Une rubrique (`KidTracker`) a un libellé
   saisi par le parent, une image choisie dans une bibliothèque neutre fournie par
   l'app, un type (choix unique, choix multiples, compteur) et ses choix
   (`KidTrackerOption`).
3. **L'app ne fournit aucune catégorie de santé** : ni rubrique, ni libellé, ni
   icône à connotation médicale ou corporelle. « Pipi » et « sieste » disparaissent.
   Le parent interprète : une goutte, une lune, ou un autre mot de son choix.
4. **Masquer plutôt que supprimer.** Une rubrique ou un choix sans saisie est
   supprimé. Avec des saisies, il est masqué (`active = false`), et il peut être
   réactivé.
5. **Modèle** : la configuration (rubriques, choix) est en tables relationnelles.
   Les valeurs d'un jour sont dans une colonne JSON (`KidDayEntry.values`), indexée
   par identifiant de rubrique. Le détail est dans
   `docs/semainier/02-plan-technique.md`, section 3.
6. **Reprise** : les rubriques issues de « pipi » et « sieste » deviennent
   « Goutte » et « Lune », en Oui / Non, avec un bandeau qui invite à les
   renommer. Elles sont masquées seulement si l'enfant n'a aucune saisie.
7. **CGU** : la page `/cgu` contient une clause « ne pas saisir de données de
   santé ». Un rappel s'affiche à la création d'une rubrique. Les comptes
   existants n'ont pas à accepter de nouveau la politique : `CONSENT_VERSION`
   reste inchangée.

### Périmètre exact de l'exception à l'ADR 0001

Elle ne vaut que pour `KidDayEntry`, `KidTracker` et `KidTrackerOption`.

- Un membre retiré du groupe, ou qui le quitte, perd l'accès au semainier de
  l'enfant, y compris à ce qu'il y a saisi. Ses saisies restent au groupe, avec
  son identifiant d'auteur, mais il ne les voit plus.
- Supprimer le groupe ou le profil enfant supprime le semainier (cascade, comme
  aujourd'hui).
- `KidTracker.createdById` est informatif et passe à `NULL` si le compte est
  supprimé. La rubrique reste au profil.
- **Suppression de compte : les saisies du semainier sont toujours transférées au
  propriétaire du groupe quand le groupe survit, quel que soit `keepShared`**
  (`src/lib/account.ts`). Une ligne de jour appartient à son premier auteur, mais
  d'autres parents la complètent dans le même objet JSON : la supprimer avec le
  compte de l'auteur ferait disparaître le jour de l'enfant pour tout le foyer, et
  des saisies d'autres personnes avec lui. Le choix `keepShared` ne vaut que pour
  ce que la personne a rangé elle-même dans le groupe (ADR 0001). Si le groupe
  disparaît (personne d'autre dedans), le semainier part avec lui, comme avant.
  Seules les lignes rangées sur le profil personnel de la personne (profil adulte,
  retiré avec son compte) disparaissent avec elle.
- Tout autre élément reste sous la règle de l'ADR 0001.

### Pourquoi pas de catégorie de santé fournie

- Les saisies portent sur un enfant identifié, et touchent au sommeil et à
  l'hygiène. Ne pas fournir ces catégories limite ce que MindDump collecte de sa
  propre initiative. La qualification juridique des saisies de la famille reste
  à faire vérifier (`docs/rgpd.md`, `docs/semainier/01-proposition.md`).
- Les stores demandent une déclaration de données et une fiche sans allusion au
  suivi de santé. L'app n'a pas à être classée dans une catégorie de santé ni dans
  la catégorie Enfants.

## Alternatives écartées

### A. Tout relationnel (une table de valeurs par jour)
- **Pour** : intégrité par clés étrangères, agrégats en SQL.
- **Contre** : trois tables pour sept lignes par semaine et par enfant ; la
  contrainte d'unicité ne s'exprime pas avec un compteur sans choix.
- **Pourquoi non** : le volume ne justifie pas la complexité, et l'intégrité
  valeur → choix se vérifie en code, à un seul endroit.

### C. Tout en JSON (configuration dans `FamilyProfile`)
- **Pour** : une seule colonne.
- **Contre** : deux parents qui modifient la vue s'écrasent ; réordonner réécrit
  tout ; les identifiants se gèrent à la main.
- **Pourquoi non** : la configuration est partagée entre membres et bouge souvent.

### Cinq rubriques fixes avec interrupteurs
- **Pour** : aucune migration de structure ; présentation déjà connue.
- **Contre** : « pipi » et « sieste » restent imposés ; l'app choisit les sujets.
- **Pourquoi non** : contraire à la décision 3.

### Semainier rattaché à l'auteur, comme l'ADR 0001 le prévoit
- **Pour** : aucune exception à écrire.
- **Contre** : une copie par parent ; le semainier d'un enfant disparaît pour le
  reste du foyer quand un parent part.
- **Pourquoi non** : le semainier est le dossier de l'enfant, pas celui d'un parent.

### Filtrer les libellés libres par liste de mots interdits
- **Pour** : bloque « médicament » à la saisie.
- **Contre** : contournable ; vexant pour les familles ; liste à maintenir.
- **Pourquoi non** : la protection repose sur le rappel, les CGU et l'absence de
  catégorie fournie (`docs/semainier/02-plan-technique.md`, section 8).

## Conséquences

### Positif
- La famille choisit ses rubriques, et l'app ne propose aucune catégorie de santé.
- Une seule bibliothèque serveur sert l'API, le MCP et l'app.
- La suppression du groupe reste celle d'aujourd'hui ; la suppression de compte ne
  fait jamais disparaître le jour d'un enfant pour le foyer.

### Négatif
- Un membre retiré perd l'accès à ses saisies dans le semainier.
- Un libellé libre peut quand même contenir un mot de santé. La protection est
  le rappel et les CGU, pas un filtre.
- La reprise de « pipi » et « sieste » demande un bandeau et une décision du parent.

### Risques
- Libellés libres de santé : rappel à la création, clause CGU, et avis juridique
  avant l'ouverture large et la soumission aux stores.
- Saisies simultanées (assistant et parent, même jour) : verrou de ligne à l'écriture.
- Interblocage (40P01) : toute écriture sur un enfant prend d'abord le verrou
  consultatif du profil (`lockProfile`), puis les lignes dans l'ordre des `id`
  (`SELECT … ORDER BY id FOR UPDATE`, puis un UPDATE ensembliste pour la reprise).
  La suppression de compte prend les mêmes verrous dans le même ordre : verrous
  consultatifs des profils concernés triés par `id` (lignes saisies ou rubriques
  créées par la personne), puis ses lignes triées par `id`. Toute nouvelle
  transaction qui écrit dans `KidDayEntry` ou `KidTracker` doit suivre cet ordre.
  Reste hors de cet ordre : le DELETE d'un profil (cascade en une instruction), qui
  n'attend que des verrous de ligne.

### Garde-fous de volume et de saisie

- 40 rubriques par enfant au plus, masquées comprises (12 actives au plus), et 40
  choix par rubrique au plus, masqués compris (16 actifs au plus ; 16 à la création).
  Une rubrique sans saisie se supprime et libère sa place.
- Les libellés sont nettoyés et comparés avec la même règle : les caractères de
  contrôle deviennent des espaces, les caractères de format Unicode (`\p{Cf}` :
  U+00AD, U+200B-200F, U+2060-2064, U+061C, U+FEFF…) sont retirés
  (`stripInvisible`, `src/lib/kidWeek.ts`). « Hu⁠meur » et « Humeur » sont un doublon.

### À retirer au contract

Une fois toutes les lignes reprises (`values` non nul pour tout enfant), lors d'un
déploiement distinct (`docs/migrations-prisma.md`) : les colonnes `weather`, `mood`,
`nap`, `accident`, `activities` ; `KidTracker.legacyKey` (et son index unique
`profileId, legacyKey`) ; `KidTrackerOption.legacyValue` ; `KidTracker.needsRename`
(avec le bandeau « à renommer » et le champ `needsRename` de l'API) ; le backfill,
`prisma/kid-legacy.js`, la lecture tolérante et la lecture des anciennes colonnes de
l'export (`loadReadableContext`).
- Fenêtre de déploiement avec l'ancienne version : déployer à une heure creuse.
