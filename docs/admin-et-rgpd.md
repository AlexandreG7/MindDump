# Dashboard admin et conformité RGPD

## Accès administrateur

L'accès repose sur `User.role === "admin"`.

| Couche | Protection |
|---|---|
| `src/middleware.ts` | `/admin` exige une session (sinon redirection `/login`). |
| `src/app/admin/page.tsx` | Relit le rôle **en base** ; un non-admin reçoit une **404** (la page ne révèle pas son existence). |
| `src/app/api/admin/*` | Chaque route commence par `requireAdmin()` (`src/lib/admin.ts`) : 401 sans session, 403 si non admin. |

Choix délibérés :

- **Les clés API (`Bearer mdk_…`) ne donnent jamais accès à l'admin.** `requireAdmin()` n'utilise pas
  `getSessionUser()`, seulement la session NextAuth. Les clés sont faites pour le MCP et sont stockées
  chez des tiers (Claude Desktop…).
- **Le rôle est relu en base à chaque requête**, pas pris dans le JWT : une rétrogradation prend effet
  immédiatement.
- **`SKIP_AUTH` ne donne jamais l'admin.** Le « dev-user » a le rôle `user` et `requireAdmin()` ignore
  le bypass. En production, le bypass est de toute façon inactif (`NODE_ENV === "production"`, voir
  `src/lib/devAuth.ts`).

Toute nouvelle route sous `src/app/api/admin/` doit commencer par :

```ts
const admin = await requireAdmin();
if (admin instanceof NextResponse) return admin;
```

### Promouvoir le premier admin

Le compte doit déjà exister (inscription normale). Ensuite :

```bash
# En local (Docker)
docker exec todo-app-1 node prisma/promote-admin.js alice@exemple.fr

# En production (Coolify) : ouvrir le terminal du conteneur de l'app
node prisma/promote-admin.js alice@exemple.fr

# Rétrograder
node prisma/promote-admin.js alice@exemple.fr --revoke
```

L'accès à `/admin` est immédiat. Le lien « bouclier » dans la barre latérale n'apparaît qu'après une
reconnexion (il lit le rôle dans le jeton de session).

## Statistiques

- Agrégats en SQL (`count`, `generate_series`, `pg_total_relation_size`) dans `src/lib/adminStats.ts`,
  lancés en parallèle et mis en cache 60 s (`unstable_cache`). Le contrôle d'accès, lui, n'est jamais
  mis en cache.
- **Connexions** : table `LoginEvent`, alimentée par `events.signIn` de NextAuth (`src/lib/auth.ts`),
  qui se déclenche pour Google comme pour email/mot de passe. On n'utilise pas le callback `signIn` :
  au premier login Google, il est appelé avant la création de l'utilisateur en base.
  L'historique démarre au déploiement ; rien d'antérieur ne peut être reconstitué. Il est purgé
  au-delà de 12 mois (durée annoncée dans `/confidentialite`).
- **Stockage** : mesure réelle de la base (`pg_database_size`, `pg_total_relation_size`) et des
  fichiers (parcours de `UPLOAD_DIR` et de `public/uploads`). La projection mensuelle est une
  estimation linéaire, signalée comme telle dans l'interface.

## Migrations Prisma

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

## RGPD

- **Consentement** : case obligatoire à l'inscription, vérifiée côté serveur (400 sans
  `consent: true`). Preuve stockée : `User.consentedAt` et `User.consentVersion`
  (`CONSENT_VERSION` dans `src/lib/consent.ts`, à incrémenter à chaque changement substantiel de la
  politique).
- **Comptes Google et comptes antérieurs** : le middleware redirige vers `/consentement` tant que
  le jeton ne porte pas `consented`. Le callback `jwt` relit la base tant que ce n'est pas le cas.
  Les routes API ne sont pas bloquées : le blocage porte sur l'interface.
- **Politique** : `/confidentialite`. Les passages `[à compléter]` sont à renseigner avant la mise
  en production.
- **Cookies** : uniquement des cookies strictement nécessaires (session NextAuth) et des préférences
  d'interface en localStorage (`theme`, `sidebarCollapsed`, `currentGroupId`). Pas de bandeau
  (exemption CNIL), mais une mention dans la politique. Les polices sont servies localement
  (`next/font`) : plus d'appel à Google Fonts.
- **Droits** : dans `/profile`, « Exporter mes données » (`GET /api/users/me/export`) et
  « Supprimer mon compte » (`DELETE /api/users/me/account`). La suppression transmet les groupes
  partagés qui ont encore des membres (au plus ancien admin, sinon au plus ancien membre), supprime
  les autres groupes ainsi que le groupe par défaut, puis efface les photos de recettes du disque.
