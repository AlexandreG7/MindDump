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
