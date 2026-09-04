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

## Import depuis une URL HelloFresh

Si l'utilisateur donne une URL HelloFresh, crée la recette via l'API avec `sourceUrl` pour déclencher l'auto-enrichissement :

```bash
curl -s -X POST "$MINDDUMP_URL/api/recipes" \
  -H "Authorization: Bearer $MINDDUMP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nom de la recette",
    "steps": [],
    "ingredients": [],
    "servings": 4,
    "groupId": "cmniwr7g7000314ldmn9onpns",
    "sourceUrl": "https://www.hellofresh.fr/recipes/..."
  }'
```

L'API enrichira automatiquement la recette (image, description, étapes avec photos, ingrédients, temps de préparation/cuisson) depuis HelloFresh.

Si l'utilisateur utilise le tool MCP `create_recipe` (qui ne supporte pas `sourceUrl`), appelle ensuite l'enrichissement manuellement :

```bash
curl -s -X PUT "$MINDDUMP_URL/api/recipes/{id}" \
  -H "Authorization: Bearer $MINDDUMP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.hellofresh.fr/recipes/...", "forceImage": true}'
```

## Import depuis des photos

L'utilisateur fournit une ou deux photos d'une fiche recette HelloFresh :
- **Face avant** : contient la photo du plat, le titre, le temps de préparation, le nombre de portions
- **Face arrière** : contient la liste des ingrédients et les étapes de préparation numérotées

### 1. Lire les images

Utilise le tool `Read` pour lire chaque image. Déduis laquelle est l'avant/arrière du contenu.

### 2. Extraire les données

Depuis la face avant :
- **title**, **description**, **prepTime** (min), **cookTime** (min), **servings**

Depuis la face arrière :
- **ingredients** : liste de `{ name, quantity, unit }`
- **steps** : liste ordonnée des étapes (texte sans numéro)

### 3. Créer la recette via MCP

Utilise `create_recipe` avec toutes les données extraites. Le groupId par défaut est `cmniwr7g7000314ldmn9onpns` (Famille).

### 4. Enrichir automatiquement

Après la création, cherche la recette correspondante sur HelloFresh et enrichis-la pour récupérer les images HD (hero + étapes). Cherche l'URL HelloFresh en utilisant le titre :

```
https://www.hellofresh.fr/search?q=NOM+DE+LA+RECETTE
```

Puis appelle l'enrichissement avec l'URL trouvée :

```bash
curl -s -X PUT "$MINDDUMP_URL/api/recipes/{id}" \
  -H "Authorization: Bearer $MINDDUMP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "URL_HELLOFRESH_TROUVEE", "forceImage": true}'
```

### 5. Confirmer à l'utilisateur

Affiche un résumé :
- Titre
- Nombre d'ingrédients et d'étapes
- Si l'image HD a été importée
- Nombre de photos d'étapes importées
- Lien vers la recette : `/recipes/{id}`

## Notes

- Les fiches HelloFresh ont un format standardisé — sois précis dans l'extraction
- Les quantités sont souvent pour 2 personnes sur la fiche
- Si une seule photo est fournie (face arrière), crée sans image puis enrichis
- L'enrichissement récupère : image HD du plat, photos des étapes, description, temps de cuisson
- Le serveur Hetzner est bloqué par HelloFresh pour le scraping HTML, mais l'API `gw.hellofresh.com` fonctionne avec un token Bearer (configuré en env var `HELLOFRESH_TOKEN`)
