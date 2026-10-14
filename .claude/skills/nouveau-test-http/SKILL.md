---
name: nouveau-test-http
description: Créer un nouveau test de non-régression HTTP MindDump sur le modèle des tests existants (base PostgreSQL jetable, serveur réellement construit, appels HTTP avec clé d'API) et le rendre bloquant au déploiement via le stage test du Dockerfile. À utiliser quand une fonctionnalité ou un correctif mérite un test qui rejoue de vrais parcours par l'API.
---

# Nouveau test HTTP bloquant

Les tests existants suivent tous le même modèle ; le nouveau doit le copier,
pas l'inventer :

| Test | Script | Fichier de test | Ports DB / app |
|---|---|---|---|
| ownership | `scripts/test-ownership.sh` | `tests/ownership.test.mjs` | 54329 / 3999 |
| reminders | `scripts/test-reminders.sh` | `tests/reminders.test.mjs` | 54339 / 3998 |
| mobile-link | `scripts/test-mobile-link.sh` | `tests/mobile-link.test.mjs` | 54340 / 3997 |
| signup | `scripts/test-signup.sh` | `tests/signup.test.mjs`, `tests/beta.test.mjs` | 54341 / 3996 |
| kids | `scripts/test-kids.sh` | `tests/kids.test.mjs` | 54343 / 3994 |

Choisir le plus proche du besoin comme point de départ : `test-ownership.sh`
pour un parcours simple, `test-kids.sh` quand il faut rejouer une migration
sur une base au schéma de production (phases `seed` / `migrated` / `verify`).

## 1. Le script `scripts/test-<nom>.sh`

Copier le script de référence et adapter seulement :

- l'en-tête : ce que le test garantit, le document de référence (ADR, doc) ;
- les variables préfixées par le nom : `<NOM>_TEST_DB_PORT`,
  `<NOM>_TEST_APP_PORT`, `<NOM>_TEST_DATABASE_URL` ;
- des **ports libres** (prendre les suivants du tableau : 54344 / 3993…) pour
  que les tests puissent tourner en parallèle ;
- le nom de la base : `minddump_<nom>_test` ;
- `NEXTAUTH_SECRET="<nom>-test-secret"`.

À garder tel quel : `set -eu`, `as_pg` (initdb refuse root), `cleanup` sur
`trap`, le refus d'une `<NOM>_TEST_DATABASE_URL` sans « test » dans le nom,
`OWNERSHIP_TEST_DB=disposable`, `unset SKIP_AUTH`, `127.0.0.1` (pas
`localhost`) pour `NEXTAUTH_URL` / `BASE_URL`, le démarrage par
`.next/standalone/server.js` sinon `next start`, l'attente du serveur
(60 s max) et l'affichage du journal du serveur en cas d'échec.
**Jamais** de `DATABASE_URL` reprise de l'environnement.

## 2. Le fichier `tests/<nom>.test.mjs`

- En-tête : ce qui est vérifié et le document de référence.
- Refuser de tourner sans `OWNERSHIP_TEST_DB === "disposable"` (exit 2).
- Reprendre les aides de `tests/ownership.test.mjs` : `check(cond, label)`
  (affiche `ok` / `FAIL`, compte les échecs), `makeUser` (utilisateur + clé
  d'API + groupe par défaut via Prisma), `api(user, method, path, body)`
  (`authorization: Bearer <clé>`).
- Passer par l'API HTTP pour tout ce qu'un utilisateur fait ; Prisma
  seulement pour préparer les données et vérifier ce qui est (ou n'est pas)
  en base.
- Toujours tester le refus : un autre utilisateur, un foyer étranger (403, et
  rien n'est créé en base), pas seulement le cas qui marche.
- Ne pas dépendre du réseau extérieur : le conteneur cloud et le build
  Docker n'ont pas forcément de DNS. Une URL externe passe par
  `assertPublicUrl` et sera refusée en 400 sans DNS ; préférer un cas qui
  échoue avant (contrôle d'accès) ou une URL IP publique littérale.
- Libellés en français, au présent : « l'auteur voit sa recette dans la vue
  du groupe ».
- Fin : afficher `N/N vérifications OK` ou
  `ÉCHEC : X vérification(s) en erreur` et sortir en code 1.

## 3. Brancher

1. `package.json` : `"test:<nom>": "sh scripts/test-<nom>.sh"`.
2. `Dockerfile`, stage `test`, après le dernier `RUN sh scripts/test-*.sh` :
   un commentaire de 2-3 lignes (ce qui est garanti, doc de référence), puis
   `RUN sh scripts/test-<nom>.sh && touch /app/.<nom>-test-passed`.
3. `Dockerfile`, stage `runner` : ajouter
   `COPY --from=test /app/.<nom>-test-passed /app/.<nom>-test-passed`
   à côté des autres. Sans cette ligne, BuildKit saute le test.
4. Si le test protège une règle d'architecture, le citer dans l'ADR ou le
   doc concerné.

## 4. Prouver

1. `npm run build && npm run test:<nom>` : tout passe.
2. Casser volontairement le code protégé (une ligne), relancer : le test doit
   échouer avec un libellé clair. Remettre le code.
3. Indiquer le nombre de vérifications et le temps d'exécution.
