# Panier drive Match

Remplir automatiquement le panier Supermarchés Match depuis une liste de courses. La personne
vérifie les produits proposés, puis choisit son créneau et paie elle-même sur le site Match :
MindDump ne passe jamais de commande.

## Pourquoi tout se passe dans le navigateur

Match n'a pas d'API publique. Son site (Nuxt) utilise deux API internes, toutes deux derrière
Cloudflare :

| Usage | Adresse |
|---|---|
| Recherche de produits (moteur Prediggo) | `POST https://produits.supermarchesmatch.fr/pred/simplePageContent` |
| Panier, compte, magasins | `https://api-drive.drive.supermarchesmatch.fr/api/…` |

Constaté en septembre 2026 :

- depuis un serveur (curl, Hetzner), elles renvoient une page de challenge Cloudflare (403) ;
- depuis une autre origine dans le navigateur (minddump.fr), la recherche est bloquée par CORS ;
- depuis une page du site Match, tout fonctionne.

Donc : **MindDump fait le classement et la mémorisation, le site Match fait la recherche et le
panier**, via un script qui tourne sur supermarchesmatch.fr (extension navigateur aujourd'hui,
WebView de l'app Capacitor plus tard, étape 3.6 de `docs/app-mobile.md`).

## Déroulé

```
Extension (supermarchesmatch.fr)                  MindDump
 │ GET /api/drive/match/plan?listId=…  ───────────▶│ articles non cochés, requête, produit mémorisé
 │ recherche Match pour chaque article (Prediggo)   │
 │ POST /api/drive/match/rank { candidats } ──────▶│ classement, quantités, confiance
 │ écran de revue (la personne ajuste)              │
 │ $store.dispatch("panier/addProduits")  (site)    │
 │ PUT /api/drive/match/products { choix } ───────▶│ mémorisé pour le groupe
 │ → /fr/panier : créneau et paiement sur Match     │
```

La recherche prend le corps `{ moduleVersion: "drive", region: "fr_FR", sessionId, advanced:
{ device, store: <id du magasin> }, pageId: 0, parameters: { page: 1, query, filters: null,
sortingCode: null } }` et renvoie `{ slots }` (garder `_type === "produit"`). Le magasin `9999` est
le catalogue web par défaut : l'extension demande de choisir un vrai magasin avant de chercher.

L'ajout au panier passe par l'action Vuex du site lui-même (`panier/addProduits` avec
`[{ sku, produitQuantite, modeAchatVente }]`), qui gère le compte, l'id de panier et l'affichage.
Elle appelle `PUT /panier/additions/produits`. **Pas encore vérifié sur un vrai compte** : à tester
à la première utilisation.

## API MindDump

Authentification : session ou `Authorization: Bearer <clé API>` (clé créée dans le profil).

- `GET /api/drive/match/plan?listId=…` → `{ store, list: {id, name}, items: [{ id, name, quantity,
  key, query, remembered }] }`.
- `POST /api/drive/match/rank` avec `{ listId, items: [{ itemId, candidates }] }` (100 articles et
  30 candidats au maximum) → `{ items: [{ itemId, needsReview, suggestions: [{ product, confidence,
  quantity, quantityUncertain, remembered, score }] }] }`. Le libellé et la quantité de l'article
  sont relus en base ; seul le catalogue vient du client, filtré par `sanitizeProduct`.
- `PUT /api/drive/match/products` avec `{ listId, choices: [{ itemId, product, quantity }] }` :
  appelé **après** un ajout réussi, mémorise le choix pour le groupe de la liste.
- `GET /api/drive/match/products[?groupId=…]` et `DELETE /api/drive/match/products?id=…` : produits
  mémorisés d'un groupe, pour une future page de gestion.

## Rapprochement article → produit

Code dans `src/lib/drive/`, testé par `npm run test:drive`.

- **Clé d'article** (`itemKey`) : minuscules, sans accents, sans quantité ni mots outils, au
  singulier. « 500 g de Tomates cerises » et « tomate cerise » donnent `tomate cerise`.
- **Produit mémorisé** : le choix du groupe pour cette clé passe toujours en tête (confiance 1).
- **Classement** des résultats Match : correspondance des mots dans le nom (1), le début d'un mot
  (0,8) ou le rayon (0,7) ; pénalités pour les produits dérivés (« sandwich » pour « jambon »,
  « sauce » pour « tomate »), les rayons non alimentaires sauf article ménager (« sel » ne donne
  pas du sel pour lave-vaisselle), les mots en trop, les produits sponsorisés ; bonus pour un
  format qui colle au besoin et pour l'ordre du moteur Match.
- **Quantités** : un produit à l'unité contient `mesure` × `mesureUnite` (0,25 « /kg » = 250 g) ;
  un produit au poids se commande par paliers de `poidsNet` (souvent 500 g). 400 g de tomates
  cerises en barquettes de 250 g → 2. Des pièces face à un produit au poids (« 3 citrons » contre
  un filet de 500 g) → 1, signalé « à vérifier ».
- **À vérifier** : confiance sous 0,7, quantité incertaine, ou aucun résultat.

Sur 25 articles courants (septembre 2026, catalogue par défaut), les 25 premiers choix sont du bon
type ; « gruyère râpé » (Match n'a que de l'emmental râpé) est signalé à vérifier.

## Données

Modèle `DriveProduct`, rattaché au groupe (voir `docs/rgpd.md`). MindDump n'envoie rien à Match
et ne reçoit ni identifiants Match, ni panier, ni commande.

## Extension

Dossier `drive-extension/`, voir son `README.md`.
