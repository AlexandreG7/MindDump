# Migrations Prisma

Le projet est passé de `prisma db push` à des migrations versionnées (`prisma/migrations`) :

- `0_init` : baseline, identique au schéma de `main` avant ce changement.
- `entrypoint.sh` lance `prisma migrate deploy` au démarrage. Sur une base existante sans historique
  (erreur P3005), il marque d'abord `0_init` comme appliquée, **une seule fois**.

⚠️ Cette baseline suppose que la base de production est exactement au niveau du schéma de `main`
(ce que garantissait `db push` à chaque déploiement). Si la prod n'a pas été redéployée depuis le
dernier changement de schéma sur `main`, la redéployer depuis `main` **avant** de déployer cette
branche.

En développement, modifier `schema.prisma` puis :

```bash
DATABASE_URL="postgresql://minddump:minddump@localhost:5432/minddump?schema=public" \
  npx prisma migrate dev --name <nom>
```
