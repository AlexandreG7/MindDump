# MindDump — Analyse marketing

Analyse préalable à la landing page. Basée sur l'audit du codebase (fonctionnalités réelles, pas de promesse inventée).

---

## 1. Ce que fait réellement l'application

Audit de `src/app/`, `prisma/schema.prisma` et `minddump-mcp/`.

| Domaine | Fonctionnalités réelles |
|---|---|
| **Todos** | Tâches, priorités (dont URGENT), dates d'échéance, notifications (`api/cron/notify`) |
| **Calendrier** | Événements, abonnements iCal externes, flux `.ics` exportable par token |
| **Courses** | Listes typées, items cochables, barre de progression, conversion liste → recette |
| **Recettes** | Catalogue (`inCatalog`) vs planifié (`planned`), ingrédients structurés, temps prépa/cuisson, portions, **mode cuisine plein écran avec wake lock** |
| **Import** | **HelloFresh, Jow, Quitoque** — recherche + import + enrichissement automatique |
| **Recette → courses** | Génération de liste de courses depuis une recette (`api/recipes/[id]/to-list`) |
| **Famille** | Groupes, membres, invitations par lien, partage des données |
| **Semainier enfant** | Journal quotidien : météo, humeur, sieste, activités + vue stats parents |
| **Assistant IA** | Serveur MCP + clés API — l'app est pilotable en langage naturel |
| **Modularité** | Feature flags par utilisateur : chacun active ce qu'il utilise |

**Fait notable :** l'app couvre l'intégralité du cycle domestique — *décider quoi manger → importer la recette → générer les courses → cocher en magasin → cuisiner*. Aucun concurrent grand public ne ferme cette boucle en entier.

---

## 2. Positionnement

### Le paysage

| Acteur | Ce qu'il fait | Ce qu'il ne fait pas |
|---|---|---|
| **Jow / HelloFresh / Quitoque** | Repas et courses, mais **enfermés dans leur propre catalogue** | Ni tâches, ni calendrier, ni vie de famille |
| **Todoist / TickTick** | Tâches performantes | Aucune notion de repas, de courses réelles, d'enfants |
| **Notion / Airtable** | Tout est possible… si on le construit soi-même | Zéro préconfiguration, coût de mise en place élevé |
| **Bring! / AnyList** | Listes de courses partagées | Îlot isolé, pas de source de recettes agrégée |

### Le trou dans le marché

Le foyer utilise **quatre applications qui ne se parlent pas**. La recette est chez Jow, la liste chez Bring!, le rendez-vous pédiatre dans Google Agenda, la tâche « rappeler le plombier » dans une note. Le travail de couture entre ces outils, c'est exactement ça, la charge mentale.

### Positionnement retenu

> **MindDump est le système d'exploitation du foyer.** Pas une app de recettes, pas une app de tâches — l'endroit unique où la logistique familiale est déchargée, partagée et exécutée.

**Angle différenciant, dans l'ordre de force :**

1. **Agrégateur, pas silo.** Seule app qui importe depuis HelloFresh *et* Jow *et* Quitoque. On ne demande pas à l'utilisateur de changer de crémerie — on va chercher la recette là où il l'a déjà trouvée.
2. **La boucle complète.** Recette importée → ingrédients extraits → liste de courses générée → mode cuisine. Un seul geste là où il en fallait six.
3. **Conçu pour un foyer, pas pour un individu.** Les groupes ne sont pas une feature entreprise recyclée : c'est le modèle de données de base.
4. **Pilotable par IA.** Le serveur MCP permet de dire « ajoute la blanquette de jeudi à la liste de courses » — l'app devient une interface conversationnelle.

---

## 3. Proposition de valeur

**Formulation canonique :**

> MindDump rassemble les repas, les courses, les tâches et le calendrier de toute la famille au même endroit — pour que plus personne n'ait à tout retenir.

**Trois variantes de headline à tester :**

| # | Headline | Registre | Quand la préférer |
|---|---|---|---|
| **A** | **Vide ta charge mentale.** *Ta famille s'occupe du reste.* | Émotionnel, culturel | ★ **Recommandée** — la tagline existe déjà dans le produit, elle est courte, elle nomme la douleur avec un mot que la cible utilise elle-même |
| **B** | **Tout le foyer. Une seule app.** *Repas, courses, tâches, enfants.* | Fonctionnel, clair | Si l'audience arrive froide et doit comprendre le périmètre en 2 secondes |
| **C** | **De la recette au caddie en un clic.** | Démonstratif | Si le trafic vient de requêtes « meal planning / liste de courses » |

**Recommandation :** A en H1, B en sous-titre. On capte l'émotion, puis on qualifie immédiatement le périmètre — sinon « charge mentale » seul reste trop abstrait pour convertir.

---

## 4. Personas

### Persona 1 — Camille, 38 ans, « le chef d'orchestre »
Deux enfants, travaille à temps plein. Porte de fait la logistique du foyer.

- **Frustration :** « Je suis la seule à savoir ce qu'il y a dans le frigo, quand est le rendez-vous dentiste, et ce qu'on mange jeudi. »
- **Ce que MindDump résout :** la charge devient *externalisée et visible* — donc partageable.
- **Message qui porte :** *Ce que tu as en tête, mets-le ici. Le reste de la famille y a accès.*

### Persona 2 — Le couple qui veut rééquilibrer
Deux adultes, volonté explicite de mieux répartir.

- **Frustration :** « Dis-moi ce qu'il y a à faire » — mais le simple fait de devoir déléguer est déjà du travail.
- **Ce que MindDump résout :** les groupes rendent la liste consultable sans passer par un intermédiaire humain.
- **Message qui porte :** *Une liste partagée vaut mieux que dix rappels.*

### Persona 3 — Le parent de jeune enfant
Utilise le semainier : humeur, sieste, activités, météo.

- **Frustration :** transmission fragmentée entre parents, nounou, grands-parents.
- **Ce que MindDump résout :** un journal continu, et des stats qui révèlent les tendances.
- **Message qui porte :** *La semaine de ton enfant, d'un coup d'œil.*

---

## 5. Hiérarchie des messages

**Bénéfice émotionnel (le H1) :** ne plus être le seul cerveau du foyer. Le soulagement, pas la productivité.

**Bénéfice fonctionnel (les sections) :** dans cet ordre de démonstration —

1. **Import de recettes multi-sources** → le « waouh » immédiat, et le plus différenciant
2. **Recette → liste de courses automatique** → l'économie de temps la plus tangible
3. **Partage familial** → ce qui transforme un outil perso en outil de foyer
4. **Tâches + calendrier** → la complétude, la raison de fermer les autres apps
5. **Semainier enfant** → la surprise, ce que personne d'autre ne propose
6. **Assistant IA** → la preuve d'avance technique

⚠️ **Règle de rédaction :** parler bénéfice, jamais feature. Pas « import HelloFresh » mais « la recette repérée ce matin est déjà dans ta liste de courses ».

---

## 6. Objections et réponses

| Objection | Réponse dans la page |
|---|---|
| *« Encore une app à remplir »* | Montrer l'import : le contenu arrive **tout seul** depuis les sites déjà utilisés. Zéro saisie. |
| *« Ma famille ne l'utilisera jamais »* | Invitation par simple lien, pas de compte à configurer. Montrer la friction quasi nulle. |
| *« Je n'ai pas besoin de tout ça »* | Feature flags : afficher explicitement qu'on active seulement ce qu'on veut. Désamorce le « too much ». |
| *« Mes données familiales »* | Auto-hébergeable, données du foyer isolées par groupe. À afficher discrètement mais visiblement. |
| *« Ça remplace quoi exactement ? »* | Section comparative implicite : les 4 apps qu'on referme. |

---

## 7. Benchmark — ce qui rend ces landing pages efficaces

| Référence | Le mécanisme à reprendre |
|---|---|
| **Linear** | Le produit *est* le visuel. Aucune illustration décorative — des captures d'interface nettes, sur fond sombre, qui donnent envie de l'utiliser. Densité d'information élevée sans surcharge. |
| **Superhuman** | Vend une **transformation identitaire**, pas des fonctionnalités (« deviens quelqu'un qui a l'inbox vide »). Transposable : « deviens un foyer qui n'oublie rien ». |
| **Jow** | Démonstration littérale du flux en 3 étapes animées. Efficace parce que le bénéfice est *montré*, pas décrit. |
| **Notion** | Progression du général vers le spécifique, avec des sections modulaires. Attention : leur défaut est justement le flou du « tout est possible » — à éviter. |
| **Arc / Raycast** | Animation scroll-driven où l'avancement du scroll pilote une démo produit. C'est **exactement** l'effet demandé ici, et c'est ce qui fait dire « ils savent coder ». |

### Enseignements appliqués

1. **Montrer l'interface réelle**, pas des pictogrammes génériques.
2. **Une section = une idée = une animation.** Pas d'empilement de blocs.
3. **Le flux import → courses doit être scroll-driven** : c'est le moment de bascule de la page.
4. **CTA de connexion permanent** en header sticky — jamais chercher où se connecter.
5. **Le français, sans anglicismes.** La cible est un foyer français ; « charge mentale » est un terme culturellement chargé, c'est un atout.

---

## 8. Structure de page recommandée

1. **Hero** — « Vide ta charge mentale » + double CTA
2. **Le problème** — la charge mentale rendue visible, puis rangée
3. **La boucle** *(scroll-driven, pièce maîtresse)* — recette → ingrédients → liste
4. **Les modules** — révélation en cascade des 5 domaines
5. **Le foyer** — partage, invitation par lien
6. **Le semainier** — la différenciation inattendue
7. **L'assistant IA** — la preuve technique
8. **CTA final** — créer un compte / se connecter

Détail de mise en œuvre : voir [`02-ux-ui.md`](./02-ux-ui.md).
