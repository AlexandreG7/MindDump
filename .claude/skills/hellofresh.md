---
name: hellofresh
description: Extraire une recette depuis des photos de fiches HelloFresh (face avant = image, face arrière = ingrédients + étapes) et la créer dans MindDump
user_invocable: true
---

# Skill : Import recette HelloFresh

L'utilisateur fournit une ou deux photos d'une fiche recette HelloFresh :
- **Face avant** : contient la photo du plat, le titre, le temps de préparation, le nombre de portions, et parfois le niveau de difficulté
- **Face arrière** : contient la liste des ingrédients (avec quantités et unités) et les étapes de préparation numérotées

## Étapes à suivre

### 1. Lire les images

Utilise le tool `Read` pour lire chaque image fournie par l'utilisateur. Si l'utilisateur ne précise pas laquelle est l'avant/arrière, déduis-le du contenu (la face avant a une grande photo de plat, la face arrière a du texte dense avec ingrédients et étapes).

### 2. Extraire les données de la face avant

Depuis la photo de la face avant, extrais :
- **title** : le nom du plat (en français)
- **description** : le sous-titre ou description courte s'il y en a
- **prepTime** : temps de préparation en minutes (icône horloge)
- **cookTime** : temps de cuisson en minutes si indiqué séparément, sinon null
- **servings** : nombre de personnes (souvent 2 ou 4)

### 3. Extraire les données de la face arrière

Depuis la photo de la face arrière, extrais :
- **ingredients** : liste de `{ name, quantity, unit }` — attention aux formats HelloFresh :
  - "2 pcs" → quantity: "2", unit: "pièces"
  - "150 g" → quantity: "150", unit: "g"
  - "1 sachet" → quantity: "1", unit: "sachet"
  - "½" → quantity: "0.5"
  - Sépare bien chaque ingrédient, même ceux groupés par étape
- **steps** : liste ordonnée des étapes de préparation. Chaque étape est un texte clair et concis. HelloFresh numérote ses étapes (1, 2, 3...). Extrais le texte de chaque étape sans le numéro.

### 4. Sauvegarder l'image de la face avant

Si une face avant est fournie, sauvegarde la photo originale dans `public/uploads/recipes/` pour l'utiliser comme image de la recette. Utilise le format :
```
public/uploads/recipes/hellofresh-{timestamp}.jpg
```

### 5. Créer la recette via l'API

Appelle l'API locale pour créer la recette :

```bash
curl -s -X POST http://localhost:3000/api/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "...",
    "description": "...",
    "servings": 4,
    "prepTime": 30,
    "cookTime": null,
    "steps": ["Étape 1...", "Étape 2...", ...],
    "ingredients": [
      {"name": "...", "quantity": "...", "unit": "..."},
      ...
    ],
    "planned": false
  }'
```

Puis uploade l'image si disponible :

```bash
curl -s -X POST http://localhost:3000/api/recipes/{id}/image \
  -F "image=@public/uploads/recipes/hellofresh-{timestamp}.jpg"
```

### 6. Confirmer à l'utilisateur

Affiche un résumé de la recette créée :
- Titre
- Nombre d'ingrédients extraits
- Nombre d'étapes extraites
- Si l'image a été attachée
- Lien vers la recette : `/recipes/{id}`

## Notes

- Les fiches HelloFresh ont un format très standardisé, profites-en pour être précis
- Les quantités sont souvent pour 2 personnes sur la fiche, mais le user peut vouloir ajuster — extrait tel quel, il ajustera via le sélecteur de portions
- Si une seule photo est fournie (face arrière uniquement), extrais ce que tu peux et crée la recette sans image
- Si le texte est difficilement lisible, indique les champs incertains à l'utilisateur
- Les étapes HelloFresh contiennent parfois des sous-titres en gras (ex: "CUIRE LES PÂTES") — ignore le sous-titre et garde uniquement le texte descriptif de l'étape
