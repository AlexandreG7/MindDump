---
name: rca-prod
description: Analyse de cause racine (RCA) d'un bug constaté sur minddump.fr, dans l'app mobile ou via le serveur MCP - reproduire, trouver la cause, écrire le test qui échoue, corriger, rendre compte. À utiliser quand Alexandre signale un problème en production (« application error », « ça ne marche plus », « X a disparu », « le MCP renvoie… », « fais une RCA »).
---

# RCA d'un bug de production

Objectif : une cause prouvée, pas une hypothèse plausible. On ne corrige
qu'après avoir vu le bug (ou sa cause exacte dans le code et les données).

## 0. Cadrer (une question au plus)

Noter : ce que fait Alexandre, ce qu'il voit, où (web, app iOS/Android, MCP,
écran mural), avec quel compte et quel foyer, depuis quand. S'il manque une
information décisive (compte utilisé, appareil), la demander en une seule
question ; sinon avancer.

## 1. Vérifier ce qui tourne

- Le bug est-il dans la version en ligne ? `https://minddump.fr/api/version`
  donne l'empreinte du commit déployé (12 premiers caractères du SHA-256) :
  `printf %s <sha> | sha256sum | cut -c1-12` pour comparer avec `main`.
  Un correctif fusionné mais pas redéployé n'est pas un nouveau bug.
- MCP : le Redeploy de l'app ne reconstruit pas le serveur MCP. Une erreur
  MCP après une livraison (« session invalid », outil inconnu) vient souvent
  d'un MCP pas redéployé ou d'un `MCP_SECRET` / `MINDDUMP_API_KEY` désaccordé.

## 2. Reproduire

Du plus fiable au moins fiable :

1. **En local sur la même version** : `npm run build`, base de test jetable
   (même mécanique que `scripts/test-*.sh`), puis le parcours par l'API
   (clé d'API) ou dans le navigateur. Viewport 390 px pour un bug signalé
   sur téléphone.
2. **En production, en lecture seule** : navigateur d'Alexandre s'il est
   disponible (console, onglet réseau), logs du conteneur dans Coolify.
   Aucune écriture en base de production pendant l'enquête.
3. **Sans reproduction** : le dire, et remonter depuis le code avec le
   message d'erreur exact.

« Application error: a client-side exception » de Next.js : l'erreur réelle
est dans la console du navigateur ; chercher une donnée inattendue (champ
`null`, relation absente, ancien format) que la page ne tolère pas.

## 3. Pistes à vérifier d'abord (déjà vues sur ce projet)

- **Élément « disparu »** : filtre d'accès. Toute liste doit passer par
  `buildResourceWhere` et toute fiche par `buildItemAccessWhere`
  (`src/lib/groupAuth.ts`) ; un `OR` fusionné par spread écrase le filtre.
  Voir ADR 0001 : un élément reste toujours visible par son auteur.
- **Groupe** : élément rangé dans le groupe du propriétaire au lieu du
  groupe courant, ou sans groupe ; deux groupes `isDefault`.
- **Dates et heures** : composantes locales vs UTC, fuseau du serveur
  différent de celui du client (hydratation de l'écran mural).
- **iOS / WebKit** : fonctions CSS ou JS absentes des vieux iOS (agent
  `mobile`, skill `pieges-ios`).
- **Photos** : fichiers dans `/app/data/uploads` servis par
  `src/app/api/uploads/`, pas par `public/`.
- **Migration** : colonne ajoutée mais backfill non joué, ancien format lu
  par le nouveau code.

## 4. Prouver la cause

Écrire d'abord le test qui échoue : dans le `tests/*.test.mjs` du domaine
(ownership, reminders, signup, kids, mobile-link), ou un nouveau test (skill
`nouveau-test-http`), ou un test unitaire `tsx --test` pour une fonction
pure. Le lancer et montrer l'échec.

## 5. Corriger

- Correctif minimal à la cause, pas au symptôme. Si d'autres routes ont le
  même défaut (même motif de code), les corriger aussi et le dire.
- Relancer le test (vert) et les tests du domaine ; groupes ou accès touchés
  → `npm run build && npm run test:ownership` (CLAUDE.md).
- Données de production déjà abîmées : ne pas les modifier dans le correctif.
  Proposer un script de reprise séparé, rejouable, à lancer après accord.

## 6. Compte rendu (court, en français)

1. **Symptôme** : ce qu'Alexandre voyait.
2. **Cause** : le mécanisme exact, fichier et ligne.
3. **Depuis quand** : commit ou livraison qui l'a introduit si on le trouve
   (`git log -S`, `git blame`).
4. **Correctif** et **preuve** (test rouge puis vert, nombre de
   vérifications).
5. **Données touchées** : combien d'éléments, s'il faut une reprise.
6. **Suite** : livraison (skill `livrer`), Redeploy MCP si concerné.
