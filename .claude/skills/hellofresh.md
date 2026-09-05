---
name: hellofresh
description: Extraire une recette depuis des photos de fiches HelloFresh ou depuis une URL HelloFresh, créer dans MindDump avec auto-enrichissement (images, étapes détaillées, ingrédients)
user_invocable: true
---

# Skill : Import recette HelloFresh

L'utilisateur fournit soit :
- **Des photos** d'une fiche recette HelloFresh (face avant = image du plat, face arrière = ingrédients + étapes)
- **Une URL HelloFresh** (ex: `https://www.hellofresh.fr/recipes/...`)
- **Le nom d'une recette** HelloFresh

## Configuration

- **API MindDump** : `$MINDDUMP_URL` + `$MINDDUMP_API_KEY`
- **GroupId par défaut** : `cmniwr7g7000314ldmn9onpns` (Famille)
- **HelloFresh API** : `gw.hellofresh.com` avec token Bearer

Le serveur Hetzner est BLOQUÉ par HelloFresh (Cloudflare 403). Toutes les requêtes vers HelloFresh doivent être faites depuis la machine locale (MCP ou navigateur client), jamais depuis le serveur.

## Import depuis une URL HelloFresh

### 1. Récupérer le token HelloFresh

```bash
TOKEN=$(curl -s "$MINDDUMP_URL/api/hellofresh-token" \
  -H "Authorization: Bearer $MINDDUMP_API_KEY" | jq -r '.token')
```

### 2. Extraire l'ID de la recette

L'ID est le hash hexadécimal de 20+ caractères dans l'URL :
```
https://www.hellofresh.fr/recipes/nom-de-recette-62abc123def456 → 62abc123def456
```

### 3. Appeler l'API HelloFresh directement (depuis la machine locale)

```bash
HF_DATA=$(curl -s "https://gw.hellofresh.com/api/recipes/$RECIPE_ID?country=FR&locale=fr-FR" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json")
```

### 4. Parser les données et créer la recette

Extraire du JSON HelloFresh :
- `name` → title
- `headline` ou `description` → description (supprimer les tags HTML)
- `imagePath` → hero image : `https://img.hellofresh.com/q_auto,f_auto,w_1200/hellofresh_s3{imagePath}`
- `steps[]` → étapes triées par `index`, texte de `instructionsMarkdown` ou `instructions` (HTML strippé), image de `images[0].path` → `https://img.hellofresh.com/q_auto,f_auto,w_750/hellofresh_s3{path}`
- `ingredients[]` + `yields[]` → ingrédients avec quantités pour 4 personnes
- `prepTime` ou `totalTime` (format `PT30M`) → temps en minutes (40% prep, 60% cuisson)

Puis créer via l'API :

```bash
curl -s -X POST "$MINDDUMP_URL/api/recipes" \
  -H "Authorization: Bearer $MINDDUMP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "...",
    "description": "...",
    "image": "https://img.hellofresh.com/...",
    "servings": 4,
    "prepTime": 12,
    "cookTime": 18,
    "steps": [{"text": "...", "image": "https://img.hellofresh.com/..."}],
    "ingredients": [{"name": "...", "quantity": "200", "unit": "g"}],
    "groupId": "cmniwr7g7000314ldmn9onpns"
  }'
```

## Import depuis des photos

L'utilisateur fournit une ou deux photos d'une fiche recette HelloFresh :
- **Face avant** : photo du plat, titre, temps de préparation, portions
- **Face arrière** : liste des ingrédients et étapes numérotées

### 1. Lire les images

Utilise le tool `Read` pour lire chaque image. Déduis laquelle est l'avant/arrière du contenu.

### 2. Extraire les données

Depuis la face avant : **title**, **description**, **prepTime**, **cookTime**, **servings**
Depuis la face arrière : **ingredients** `[{ name, quantity, unit }]`, **steps** `[texte]`

### 3. Créer la recette via MCP

Utilise `create_recipe` avec toutes les données extraites.

### 4. Enrichir automatiquement

Après la création, cherche la recette sur HelloFresh via l'API :

```bash
TOKEN=$(curl -s "$MINDDUMP_URL/api/hellofresh-token" \
  -H "Authorization: Bearer $MINDDUMP_API_KEY" | jq -r '.token')

SEARCH=$(curl -s "https://gw.hellofresh.com/api/recipes/search?country=FR&locale=fr-FR&q=NOM+RECETTE&limit=1" \
  -H "Authorization: Bearer $TOKEN")
```

Puis récupère les données complètes de la recette trouvée et met à jour via PATCH :

```bash
curl -s -X PATCH "$MINDDUMP_URL/api/recipes/{id}" \
  -H "Authorization: Bearer $MINDDUMP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "https://img.hellofresh.com/...",
    "steps": [{"text": "...", "image": "..."}],
    "description": "...",
    "prepTime": 12,
    "cookTime": 18
  }'
```

### 5. Confirmer à l'utilisateur

Affiche un résumé : titre, nombre d'ingrédients/étapes, si l'image HD a été importée, nombre de photos d'étapes, lien `/recipes/{id}`.

## Notes

- Les fiches HelloFresh ont un format standardisé — sois précis dans l'extraction
- Les quantités sont souvent pour 2 personnes sur la fiche
- Si une seule photo est fournie (face arrière), crée sans image puis enrichis
- Utiliser `img.hellofresh.com` pour les images (PAS `d3hvwccx09j84u.cloudfront.net` qui est mort)
- Le serveur Hetzner est bloqué par HelloFresh — toujours appeler l'API HF depuis la machine locale
