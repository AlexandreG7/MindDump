# Extension « MindDump — Panier Match »

Remplit ton panier Supermarchés Match depuis une liste de courses MindDump. Tu vérifies les
produits proposés, puis tu choisis ton créneau et tu paies sur le site Match.

Fonctionnement et API : `docs/drive-match.md`.

## Installation (Chrome, Edge, Brave)

1. `chrome://extensions` → activer le **mode développeur**.
2. **Charger l'extension non empaquetée** → choisir ce dossier `drive-extension/`.
3. Dans MindDump, **Profil → Clés API → Créer une clé**, et la copier.
4. Cliquer sur l'icône de l'extension, coller la clé, enregistrer.

## Utilisation

1. Sur supermarchesmatch.fr, se connecter et **choisir son magasin** (les produits et les prix en
   dépendent).
2. Icône de l'extension → choisir la liste → **Remplir le panier**.
3. Dans le panneau : vérifier les articles marqués « à vérifier », changer de produit dans la liste
   déroulante, ajuster les quantités, décocher ce qu'on ne veut pas.
4. **Ajouter au panier** → **Voir mon panier** → créneau et paiement sur Match.

Les produits ajoutés sont retenus pour le foyer : la fois suivante, ils sont proposés en premier
(badge « habituel »).

## Fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | Manifest V3 |
| `background.js` | Seul point d'appel à MindDump (clé API, liste blanche de routes) |
| `content.js` | Sur le site Match : recherche, panneau de revue, enchaînement |
| `page.js` | Dans la page Match (monde principal) : contexte du site et ajout au panier par l'action `panier/addProduit` du site (celle du bouton « Ajouter »), produit par produit |
| `popup.html`, `popup.js` | Réglages (clé, adresse) et choix de la liste |

Pour un serveur MindDump de test, indiquer son adresse dans les réglages (`http://localhost:3000`
est accepté) : Chrome demande alors l'autorisation pour cette adresse.
