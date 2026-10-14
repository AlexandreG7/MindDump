---
name: livrer
description: Mettre en production une branche MindDump validée - contrôles, merge dans main, Redeploy Coolify de l'app et, si besoin, du serveur MCP, puis vérification en ligne. À utiliser quand Alexandre dit « merge dans main », « déploie », « mets en prod » ou « livre ».
---

# Livrer en production

minddump.fr tourne sur Coolify (Hetzner). Le déploiement est **manuel** :
rien ne part tant qu'Alexandre n'a pas dit « oui » pour **cette** livraison.
Un « oui » donné pour une livraison précédente ne compte pas.

## 1. Contrôles (avant de demander le feu vert)

À lancer sur la branche à livrer, fusionnée avec le `main` à jour
(`git fetch origin main && git merge origin/main`) :

1. `npm run lint` et `npm run build`.
2. Tests qui concernent le diff (ils tournent tous au build Docker, un échec
   bloque le déploiement) :
   - groupes, adhésions, profils, filtres d'accès → `npm run test:ownership`
   - rappels → `test:reminders` ; inscription → `test:signup` ;
     semainier → `test:kids` ; lien mobile → `test:mobile-link`
   - `minddump-mcp/` modifié → `cd minddump-mcp && npm run build` et ses
     `test:*`.
3. `git diff origin/main...HEAD` relu : pas de `.env`, de secret, de ligne
   `DEVELOPMENT_TEAM` (Xcode), de `.impeccable/hook.cache.json` divergent.
4. Migrations : lister chaque dossier nouveau de `prisma/migrations/` avec son
   SQL. Tout `DROP`, `RENAME`, `ALTER COLUMN` ou `DELETE` : s'arrêter et
   expliquer (`docs/migrations-prisma.md` : l'entrypoint refusera de démarrer).
5. Nouvelles variables d'environnement (`git diff origin/main...HEAD -- .env.example`,
   `process.env.` ajoutés) : à créer dans Coolify **avant** le Redeploy.

## 2. Récapitulatif et feu vert

Présenter en quelques lignes : commits livrés, résultats des contrôles,
migrations, variables à créer, Redeploy à faire (app, MCP, les deux), nouveau
build mobile nécessaire ou non (seulement si `mobile/` natif a changé : la
coque charge minddump.fr). Puis demander le « oui » (AskUserQuestion).

## 3. Merge

- Avance rapide si possible : `git push origin HEAD:main`.
- Si le push sur `main` est refusé (contrôle de sécurité ou droits) : pousser
  la branche et donner à Alexandre la commande exacte
  `git push origin <branche>:main`. Ne pas forcer, ne pas réécrire `main`.
- Noter le SHA livré : `git rev-parse origin/main`.

## 4. Redeploy Coolify

Seulement si le navigateur Chrome d'Alexandre est disponible (session locale) ;
sinon lui donner les étapes et s'arrêter là.

1. Application **app** (minddump.fr) : Redeploy, puis onglet Deployments
   jusqu'à « Deployment is Finished ». Le build prend 2-3 min ; le stage
   `test` du Dockerfile rejoue les tests.
2. Application **MCP** (base dir `/minddump-mcp`) : seulement si
   `minddump-mcp/` a changé. **Le Redeploy de l'app ne reconstruit pas le
   MCP**, et un MCP non redéployé donne des erreurs du type « session
   invalid ».
3. Échec du build :
   - `npm ci` tué sans message (512 Mo de RAM) : un seul nouveau Redeploy.
   - Un test du stage `test` échoue : l'ancienne version reste en ligne ;
     rapporter le test et le journal, corriger sur la branche, ne pas
     relancer à l'identique.
   - L'entrypoint refuse de migrer : ne rien forcer, la sauvegarde est dans
     `/app/data/backups` (voir `docs/migrations-prisma.md`).

## 5. Vérifier en ligne

1. Version déployée : `https://minddump.fr/api/version` renvoie
   `{ build }`, les 12 premiers caractères du SHA-256 du commit livré :
   ```bash
   printf %s "$(git rev-parse origin/main)" | sha256sum | cut -c1-12
   ```
   Les deux doivent être égaux ; sinon l'ancienne version tourne encore.
2. Parcourir les pages et routes touchées par la livraison (navigateur si
   disponible), console sans erreur.
3. MCP redéployé : appeler un outil en lecture (`list_groups`) pour vérifier
   qu'il répond.

## Compte rendu

SHA livré, Redeploy faits (app / MCP), version en ligne vérifiée ou non (et
pourquoi), ce qui reste à faire par Alexandre (variables Coolify, build
mobile, commande de push).
