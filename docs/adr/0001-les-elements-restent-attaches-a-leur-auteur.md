# ADR 0001 — Les éléments restent attachés à leur auteur

- Statut : accepté
- Date : 2026-09-27

## Contexte

Recettes, tâches, listes de courses, événements et abonnements calendrier ont un
auteur (`userId`, obligatoire) et un groupe (`groupId`, facultatif). L'interface
affiche toujours la vue d'un groupe (le groupe courant, choisi par défaut).

Jusqu'ici, la visibilité passait uniquement par le groupe : la vue d'un groupe ne
montrait que ses éléments, et la vue sans filtre ne montrait les éléments de
l'auteur que s'ils n'avaient pas de groupe. Dès qu'un élément sortait des groupes
de son auteur, il disparaissait pour lui, sans qu'aucune donnée ne soit effacée :

- auteur retiré d'un groupe, ou qui le quitte ;
- groupe supprimé (`groupId` repasse à `null` par `onDelete: SetNull`) ;
- toute future évolution qui déplace, recrée ou réaffecte des groupes.

Des recettes ont ainsi « disparu » pour leur auteur.

Par ailleurs, la vue mensuelle du calendrier écrasait le filtre d'accès (deux clés
`OR` fusionnées par spread) et exposait les événements d'autres utilisateurs.

## Décision

**Règle absolue : un élément reste toujours visible par son auteur, quel que soit
le sort de son groupe.** Aucune évolution ne doit pouvoir détacher un élément de
son utilisateur.

Mise en œuvre (`src/lib/groupAuth.ts`, `buildResourceWhere`) :

- vue d'un groupe : éléments du groupe **+** éléments « orphelins » de
  l'utilisateur (sans groupe, ou dans un groupe dont il n'est plus membre) ;
- vue sans filtre : **tous** les éléments de l'utilisateur + ceux de ses groupes ;
- fiche d'un élément (`buildItemAccessWhere`) : l'auteur ou un membre du groupe.

Le filtre est renvoyé sous une clé `AND` : un appelant qui ajoute ses conditions
les combine avec `AND`, jamais par spread d'un second `OR`.

Ce qui en découle :

- quitter un groupe ne retire rien à personne : les éléments restent au groupe
  (les autres membres les voient) et leur auteur les voit toujours ;
- aucun script de migration ou de backfill ne modifie `userId` d'un élément, sauf
  la suppression de compte avec « garder ce qui est partagé » (transfert explicite
  au propriétaire du groupe, choisi par l'utilisateur, voir `src/lib/account.ts`) ;
- un changement qui touche aux groupes, aux adhésions, aux profils du foyer ou aux
  filtres d'accès doit être vérifié du point de vue de l'utilisateur : ce qu'il
  voyait avant, il le voit après.

## Garde-fou : test de non-régression bloquant

`tests/ownership.test.mjs`, lancé par `scripts/test-ownership.sh`, joue par HTTP,
sur une base PostgreSQL jetable et le serveur réellement construit, les parcours
qui ont fait disparaître des éléments : synchronisation des profils du foyer,
retrait d'un membre, suppression d'un groupe, départ volontaire. À chaque étape il
vérifie que l'auteur voit ses éléments dans la vue du groupe courant, sans filtre
et dans la fiche, et que personne d'autre n'y a accès.

Il tourne dans le stage `test` du `Dockerfile` : **un échec fait échouer le build,
donc le déploiement**, et l'ancienne version reste en ligne. En local :
`npm run build && npm run test:ownership`.

Tout nouveau type d'élément rattaché à un utilisateur et à un groupe doit utiliser
`buildResourceWhere` / `buildItemAccessWhere` et être ajouté à ce test.

## Conséquences

- Un élément orphelin apparaît dans la vue de chacun des groupes de son auteur :
  mieux vaut le voir en double que ne plus le voir.
- Le build Docker installe PostgreSQL dans un stage de test (non présent dans
  l'image finale) et dure quelques secondes de plus.
