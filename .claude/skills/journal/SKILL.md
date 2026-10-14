---
name: journal
description: Consigner ce qu'une session MindDump a décidé ou changé - entrée datée dans docs/journal.md (décision, raison, conséquence), ADR pour un choix d'architecture, doc du domaine pour un comportement. À utiliser en fin de chantier, quand le hook de fin de tour le demande, ou quand Alexandre demande de « reprendre ce qui a été décidé ».
---

# Tenir le journal

But : dans six mois, savoir **ce qui a été tranché, pourquoi, et ce que ça
change**, sans relire le code ni les sessions. Sans la raison, personne ne
sait s'il est légitime de défaire une décision.

## 1. Y a-t-il quelque chose à consigner ?

Relire le diff de la branche (`git diff origin/main...HEAD --stat`, puis les
fichiers utiles) et les échanges de la session. On consigne :

- une **décision** prise avec Alexandre ou une option écartée (et pourquoi) ;
- un **changement de comportement** visible pour un utilisateur (règle
  d'accès, rappel, import, ce que l'app promet ou ne fait plus) ;
- une **contrainte** découverte (limite d'iOS, blocage d'un fournisseur,
  piège de migration) ;
- ce qui est **volontairement laissé de côté** et doit être repris.

On ne consigne pas : refactorisation sans effet visible, correction de
libellé, mise en forme, dépendance mise à jour sans conséquence. Dans ce
cas, le dire en une ligne et s'arrêter : ne pas écrire pour écrire.

## 2. Choisir l'endroit

| Nature | Où |
|---|---|
| Choix d'architecture durable (données, accès, découpage, sécurité) | ADR `docs/adr/NNNN-titre-en-kebab.md` (numéro suivant, format des ADR 0001 et 0002) + une ligne dans `CLAUDE.md` si c'est une règle pour les agents |
| Fonctionnement d'un domaine qui a déjà sa doc | La doc du domaine : `docs/semainier/`, `docs/app-mobile.md`, `docs/oauth.md`, `docs/migrations-prisma.md`, `docs/rgpd.md`… |
| Promesse produit ou message marketing | `docs/landing-page/` et `PRODUCT.md` (« ce que le code rend dicible ») |
| Tout le reste (décisions de session, arbitrages, reports) | `docs/journal.md` |

Une décision structurante va souvent à deux endroits : l'ADR pour la règle,
une ligne du journal qui la pointe.

## 3. Écrire l'entrée de `docs/journal.md`

La plus récente en haut, sous l'en-tête du fichier :

```markdown
## AAAA-MM-JJ — Titre court du chantier

| Décision | Raison | Conséquence |
|---|---|---|
| Ce qui a été tranché | Pourquoi (le problème réel, l'option écartée) | Ce que ça change : code, données, promesse, ce qui reste interdit |

- **Laissé de côté** : … (et à quelle condition le reprendre)
- **Références** : commits, ADR, doc du domaine
```

Règles : français, phrases courtes, fait plutôt qu'intention ; nommer les
fichiers, les routes ou les outils MCP concernés ; une **seule entrée par
session** (la compléter si elle existe déjà pour aujourd'hui et ce chantier).

## 4. Finir

- Commit séparé : `docs(journal): …` (ou `docs(adr): …`).
- Vérifier les liens relatifs entre documents.
- Dire en une ligne à Alexandre ce qui a été consigné et où.
