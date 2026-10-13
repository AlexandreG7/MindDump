# Migrations Prisma et sauvegardes

Principe : **les données passent avant la disponibilité.** Au moindre doute, l'app refuse de
démarrer, sans toucher à la base, plutôt que de migrer.

Le projet est passé de `prisma db push --accept-data-loss` (qui pouvait supprimer des colonnes à
chaque démarrage) à des migrations versionnées (`prisma/migrations`). Toutes les migrations
existantes sont purement additives : ajout de colonnes nullables, de tables et d'index.

## Ce que fait `entrypoint.sh` au démarrage

1. `prisma migrate status`. Si la base est à jour : rien d'autre, **aucune écriture**.
2. Si une migration précédente est **en échec** : arrêt immédiat, pas de nouvelle tentative
   automatique (voir « Incident » plus bas).
3. Sinon (migration en attente) : **sauvegarde obligatoire** (voir plus bas). Si elle échoue, ou si
   `/app/data/backups` n'est pas un volume persistant : arrêt, rien n'est migré.
4. `prisma migrate deploy`.
5. Cas particulier de la première mise en production (base créée par `db push`, sans historique,
   erreur P3005) : l'entrypoint calcule l'écart réel entre la base et `schema.prisma`.
   - S'il ne contient **que des ajouts**, il l'applique dans une transaction, puis marque les
     migrations comme appliquées. Cela fonctionne aussi si la prod a pris du retard sur `main`.
   - S'il contient le moindre ordre destructeur (`DROP`, `RENAME`, `TRUNCATE`, `DELETE FROM`,
     `ALTER COLUMN`) : **arrêt sans rien modifier**, l'écart est affiché dans les logs.

Scénarios vérifiés sur des copies de la base (septembre 2026) : prod au niveau de `main`, prod en
retard (colonne manquante), prod avec une colonne inconnue du schéma (arrêt, donnée conservée),
volume absent, volume en lecture seule, migration précédente en échec, redémarrage sans migration
en attente. Données identiques avant/après dans tous les cas, et restauration d'une sauvegarde
vérifiée table par table.

## Sauvegardes automatiques

- Fichiers `minddump-AAAAMMJJ-HHMMSS.sql.gz` (SQL complet compressé, `pg_dump`) dans
  `/app/data/backups` (`BACKUP_DIR`), créés **avant chaque migration**.
- Une sauvegarde n'est acceptée que si l'archive est intacte et que le dump est allé jusqu'au bout.
- Rotation (`prisma/rotate-backups.js`) : les **3 plus récentes**, plus **la plus récente de chaque
  semaine pendant 3 mois**. Rien d'autre dans le dossier n'est touché.

### À faire une fois dans Coolify

Ajouter un **Persistent Storage** sur l'app : destination `/app/data/backups` (même principe que
`/app/data/uploads`), accessible en écriture à l'utilisateur 1001 (`nextjs`). Sans ce volume, l'app
refuse d'appliquer une migration (message explicite dans les logs). Une échappatoire existe
(`ALLOW_EPHEMERAL_BACKUPS=true`), à n'utiliser qu'en connaissance de cause : la sauvegarde serait
perdue au déploiement suivant.

Ces sauvegardes sont sur le même serveur que la base. Elles protègent d'une migration ratée, pas
d'une perte du serveur : garder aussi une sauvegarde externe (snapshots Hetzner ou copie régulière
hors serveur).

### Restaurer

Toujours dans une **nouvelle** base, jamais par-dessus la base en service :

```bash
# Depuis le terminal du conteneur de l'app (psql y est installé)
psql "postgresql://USER:MDP@HOTE:5432/minddump" -c 'CREATE DATABASE minddump_restore'
gunzip -c /app/data/backups/minddump-AAAAMMJJ-HHMMSS.sql.gz \
  | psql -v ON_ERROR_STOP=1 "postgresql://USER:MDP@HOTE:5432/minddump_restore"
```

Vérifier la base restaurée, puis pointer `DATABASE_URL` dessus (ou renommer les bases) et
redéployer.

## Incident : migration en échec

L'app ne redémarre pas tant que ce n'est pas résolu (c'est voulu). Dans le terminal du conteneur :

```bash
node ./node_modules/prisma/build/index.js migrate status
```

Puis, selon le cas : corriger la base et `migrate resolve --applied <migration>`, ou
`migrate resolve --rolled-back <migration>` après avoir restauré la sauvegarde faite juste avant.

## Écrire une migration

Toujours additive quand c'est possible (colonne nullable ou avec valeur par défaut, nouvelle
table). Pour renommer ou supprimer : d'abord ajouter, migrer les données, déployer, puis supprimer
dans un déploiement ultérieur.

```bash
DATABASE_URL="postgresql://minddump:minddump@localhost:5432/minddump?schema=public" \
  npx prisma migrate dev --name <nom>
```

## Adresses e-mail et casse : index unique sur `lower(email)` (à faire plus tard)

`User.email` est unique **sensible à la casse**. Les nouveaux comptes sont stockés en minuscules et
la création est sérialisée par un verrou (`pg_advisory_xact_lock`, `src/lib/signupInvite.ts`), mais
la base n'interdit pas deux adresses qui ne diffèrent que par la casse. Un index unique sur
`lower(email)` n'est **pas** ajouté par la migration `20261011120000_beta_access` : il échouerait
(et empêcherait l'app de démarrer) s'il existe déjà un doublon, et Prisma ne sait pas exprimer un
index fonctionnel (il apparaîtrait comme un écart au prochain `migrate diff`). Marche à suivre :

```sql
-- 1. Détecter les doublons (à lancer sur la base de production, lecture seule)
SELECT lower(email) AS email, count(*), array_agg(id) AS ids
FROM "User" WHERE email IS NOT NULL
GROUP BY lower(email) HAVING count(*) > 1;
-- 2. S'il n'y en a aucun : migration SQL manuelle (--create-only)
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower(email));
```

S'il y en a, les fusionner à la main d'abord (ADR 0001 : ne supprimer aucun élément de personne).

## Semainier : rubriques choisies par la famille (expand fait, contract à prévoir)

Migration `20261013100000_kid_trackers` (additive : 2 tables, 1 colonne `values` nullable). Au
démarrage, `prisma/backfill-kid-trackers.js` (après `backfill-kid-profiles.js`) crée les rubriques
reprises de chaque enfant qui a des saisies et convertit ses lignes en `values`, sans toucher aux
anciennes colonnes. Rejouable sans effet ; en attendant, l'app convertit à la lecture une ligne
dont `values` est nul (`src/lib/kidTrackers.ts`). Les deux partagent `prisma/kid-legacy.js`.
`scripts/test-kids.sh` (stage `test`) rejoue la reprise sur une base au schéma de production.

**Contract (au moins une semaine après, déploiement distinct)** : vérifier en lecture sur la prod
`SELECT count(*) FROM "KidDayEntry" WHERE "values" IS NULL AND "profileId" IS NOT NULL;` = 0, puis
supprimer `weather`, `mood`, `nap`, `accident`, `activities`, `KidTracker.legacyKey` (et son index
unique `profileId, legacyKey`), `KidTrackerOption.legacyValue`, `KidTracker.needsRename` (avec le
bandeau « à renommer » et le champ de l'API), le backfill, `prisma/kid-legacy.js`, la lecture
tolérante, la lecture des anciennes colonnes de l'export (`loadReadableContext`) et
`GET`/`PATCH /api/kids`.

La reprise est écrite pour ne pas bloquer un démarrage : une transaction par enfant, avec son
propre `try/catch` (un enfant en échec est ignoré et repris au démarrage suivant ; le journal ne
contient ni nom ni identifiant), les lignes verrouillées dans l'ordre des `id` puis converties par
un seul UPDATE ensembliste. Verrous du semainier : voir l'ADR 0002, section Risques.
