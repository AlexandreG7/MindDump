# Dashboard admin

Page `/admin` : statistiques d'usage, réservée aux comptes administrateurs.

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
  au-delà de 12 mois (durée annoncée dans la politique de confidentialité, voir `docs/rgpd.md`).
- **Stockage** : mesure réelle de la base (`pg_database_size`, `pg_total_relation_size`) et des
  fichiers (parcours de `UPLOAD_DIR` et de `public/uploads`). La projection mensuelle est une
  estimation linéaire, signalée comme telle dans l'interface.

Les nouvelles colonnes et la table `LoginEvent` sont créées par migration : voir `docs/migrations-prisma.md`.
