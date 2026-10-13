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
- La suppression de compte avec « garder ce qui est partagé » transfère les
  saisies au propriétaire du groupe. C'est le transfert existant, choisi par
  l'utilisateur (`src/lib/account.ts`).
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
- Le transfert de compte et la suppression du groupe restent ceux d'aujourd'hui.

### Négatif
- Un membre retiré perd l'accès à ses saisies dans le semainier.
- Un libellé libre peut quand même contenir un mot de santé. La protection est
  le rappel et les CGU, pas un filtre.
- La reprise de « pipi » et « sieste » demande un bandeau et une décision du parent.

### Risques
- Libellés libres de santé : rappel à la création, clause CGU, et avis juridique
  avant l'ouverture large et la soumission aux stores.
- Saisies simultanées (assistant et parent, même jour) : verrou de ligne à l'écriture.
- Fenêtre de déploiement avec l'ancienne version : déployer à une heure creuse.
