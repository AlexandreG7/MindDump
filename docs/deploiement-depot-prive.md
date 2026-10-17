# Repasser le dépôt GitHub en privé sans casser les déploiements Coolify

Statut : **à exécuter plus tard** (le dépôt a été remis en public le 17/10/2026 après l'échec des
Redeploy : `fatal: could not read Username for 'https://github.com'`).

## Pourquoi ça casse

Les deux ressources Coolify (app MindDump et serveur MCP) ont été créées en **« Public Repository »** :
Coolify clone `https://github.com/AlexandreG7/MindDump` sans identifiants. Dès que le dépôt est privé,
GitHub répond 404 et le déploiement échoue (la prod en place continue de tourner, rien n'est remplacé).

Il faut donc donner à Coolify un accès en lecture **avant** de passer le dépôt en privé.

## Méthode retenue : GitHub App (recommandée)

Avantages : accès limité au seul dépôt choisi, webhooks de push possibles, révocable depuis GitHub.
Alternative : clé de déploiement (voir plus bas), si l'installation d'une app pose problème.

### Étape 0 — Relever la configuration actuelle (dépôt encore public)

Pour **chaque** ressource (app MindDump, serveur MCP), noter dans un fichier hors du dépôt :

- [ ] Branche (`main`), **Build pack** (Dockerfile), **Base directory** (racine pour l'app,
      `minddump-mcp` ? pour le MCP — à vérifier), cible Docker éventuelle, port exposé.
- [ ] Domaines (minddump.fr, sous-domaine du MCP), redirections HTTPS.
- [ ] **Variables d'environnement** (export ou copie, y compris celles marquées build) :
      `DATABASE_URL`, `NEXTAUTH_*`, `GOOGLE_*`, `APPLE_*`, `PRIVACY_*`, SMTP, `MINDDUMP_API_*`…
- [ ] **Stockage persistant** (volumes, dont celui des sauvegardes de la base) et healthcheck.
- [ ] Ce qui déclenche les déploiements (manuel « Redeploy » aujourd'hui).

Ne rien modifier à cette étape.

### Étape 1 — Créer la source GitHub App (dépôt encore public)

1. Coolify → **Sources** → **New source** → **GitHub App**.
2. Nom : `github-minddump`. **Organization** : vide (compte personnel).
3. Webhook endpoint : **Use an instance endpoint** (URL de base de l'instance Coolify, sans `/webhooks`).
4. **Register with GitHub** → sur GitHub, nom unique (ex. `coolify-minddump-alexandre`) → **Create GitHub App**.
5. **Install repositories** → **Only select repositories** → `AlexandreG7/MindDump` → **Install**.
6. De retour dans Coolify : la source affiche une installation et le dépôt dans **General → Repositories**.

### Étape 2 — Basculer les deux ressources sur cette source (dépôt encore public)

Essayer d'abord sans recréer :

1. Ouvrir la ressource → onglet **Git Source** → choisir `github-minddump` sous **Git source**,
   vérifier **Repository** = `AlexandreG7/MindDump`, branche `main` → **Save changes**.
2. **Redeploy** et lire **Deployment Logs** : le clone doit passer par l'app GitHub
   (plus d'URL `https://github.com/...` anonyme), sur le bon commit.
3. Refaire pour le MCP.

> Si l'onglet **Git Source** ne propose pas de changer la source (ressource créée en
> « Public Repository »), recréer la ressource : projet → **+ New** →
> **Private Repository (with GitHub App)** → serveur `localhost` → source `github-minddump` →
> dépôt → **Load Repository** → reprendre **exactement** la configuration notée à l'étape 0
> (build pack, base directory, port, variables, domaines, volumes). Déployer la nouvelle ressource,
> vérifier, **puis seulement** déplacer le domaine et supprimer l'ancienne.
> Attention au volume de sauvegarde de la base et aux variables marquées « build ».

### Étape 3 — Vérifier encore en public

- [ ] Les deux Redeploy passent avec la nouvelle source.
- [ ] `https://minddump.fr` répond, connexion OK, `/api/version` montre le nouveau build.
- [ ] Le MCP répond (un outil simple depuis Claude).

### Étape 4 — Passer le dépôt en privé

1. GitHub → dépôt → **Settings** → **Danger Zone** → **Change visibility** → **Private**.
2. **Redeploy** de l'app puis du MCP, sans autre changement : les logs doivent montrer un clone réussi.
3. Vérifier que `curl -s -o /dev/null -w "%{http_code}" https://github.com/AlexandreG7/MindDump`
   renvoie 404 (dépôt bien privé).

### Retour arrière

À n'importe quelle étape : repasser le dépôt en **Public** (Settings → Change visibility).
Les ressources en « Public Repository » refonctionnent immédiatement ; une ressource passée sur la
GitHub App continue aussi de fonctionner en public. Ne supprimer l'ancienne ressource (si recréée)
qu'après une semaine sans incident.

## Alternative : clé de déploiement (lecture seule)

1. Coolify → **Keys & Tokens** → **Private Keys** → **New private key** → **Generate ED25519**
   → **Edit** → copier la **Public key**.
2. GitHub → dépôt → **Settings** → **Deploy keys** → **Add deploy key** → coller, **Allow write
   access** décoché.
3. Coolify → **+ New** → **Private Repository (with Deploy Key)** → `localhost` → la clé →
   URL SSH `git@github.com:AlexandreG7/MindDump.git` → même configuration qu'à l'étape 0.
   (La doc Coolify ne décrit que la création d'une nouvelle ressource pour cette méthode.)

## À vérifier aussi avant de passer en privé

- Rien d'autre ne lit le dépôt anonymement : le proxy HelloFresh (Cloudflare Worker) et les builds
  mobiles se font en local ; pas de GitHub Actions publiques connues — à confirmer.
- Les liens publics vers le dépôt (README, landing, docs) deviendront des 404.

Sources : documentation Coolify — [GitHub App](https://coolify.io/docs/applications/sources/github/app),
[Switch GitHub Apps](https://coolify.io/docs/applications/sources/github/switch-apps),
[Deploy key](https://coolify.io/docs/applications/sources/github/deploy-key).
