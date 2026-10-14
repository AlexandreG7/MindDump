---
name: hellofresh
description: Importer une recette HelloFresh dans MindDump à partir d'une URL, d'un nom de recette ou de photos d'une fiche (recto/verso), avec photo, ingrédients et étapes enrichis. À utiliser dès qu'Alexandre partage une fiche ou un lien HelloFresh.
---

# Importer une recette HelloFresh

Tout passe par le serveur MCP MindDump (`mcp__MindDump__*`, à charger avec
ToolSearch si besoin). Le serveur MindDump appelle HelloFresh lui-même, via le
proxy Cloudflare (`hellofresh-proxy/`, variables `HELLOFRESH_PROXY_URL` /
`HELLOFRESH_PROXY_SECRET`) : aucun appel direct à `gw.hellofresh.com`, aucun
token à récupérer à la main.

## Groupe de la recette

Ne jamais écrire d'identifiant de groupe en dur. Sans `groupId`, la recette va
dans le groupe par défaut de l'utilisateur (`resolveGroupId`), ce qui convient
presque toujours. S'il veut un autre foyer : `list_groups`, puis passer
l'`id` choisi.

## Depuis une URL

1. `import_hellofresh` avec `url` (paramètres de requête inutiles), `servings`
   (4 par défaut), `planned: true` seulement si Alexandre veut la mettre au
   menu.
2. Une URL qui n'est pas une fiche recette (liste, accueil) renvoie 422 : le
   dire, ne pas créer de recette vide.

## Depuis un nom

1. `search_hellofresh` avec le nom (mots-clés du titre, sans accompagnements
   superflus).
2. Plusieurs résultats proches : montrer les 2-3 premiers (titre, accroche,
   temps) et demander lequel. Un seul résultat évident : l'importer.
3. `import_hellofresh` avec l'`url` retenue.

## Depuis des photos de fiche

1. Lire chaque image (Read). Recto : photo du plat, titre, temps, portions.
   Verso : ingrédients et étapes numérotées. Une seule photo suffit.
2. `search_hellofresh` avec le titre lu sur la fiche.
   - Trouvée : `import_hellofresh` (données officielles, photos HD des étapes).
   - Introuvable : `create_recipe` avec ce qui a été lu
     (`title`, `servings`, `prepTime`, `cookTime`, `ingredients`
     `[{ name, quantity, unit }]`, `steps` en texte). Si Alexandre a fourni
     la photo du plat, la joindre avec `set_recipe_photo` (`imagePath` ne
     marche qu'avec le MCP local ; sinon `imageBase64`).
3. Recette déjà créée à la main et retrouvée ensuite sur HelloFresh :
   `enrich_recipe_hellofresh` avec `recipeId` et l'URL.

Les fiches papier donnent souvent les quantités pour 2 : le préciser dans
`servings` plutôt que recalculer à la main.

## Avant d'importer

`list_recipes` (ou une recherche dans la réponse) pour éviter un doublon : si
une recette du même titre existe déjà, demander s'il faut l'enrichir plutôt
que la recréer.

## Compte rendu

Titre, nombre d'ingrédients et d'étapes, photo principale présente ou non,
groupe, lien `https://minddump.fr/recipes/{id}`.

## En cas d'échec

- 502 « Impossible de récupérer la recette » : HelloFresh bloque ou le proxy
  est en panne. Ne pas contourner depuis la session : passer par la création
  manuelle depuis les photos, et signaler l'incident (agent `integrations`).
- Images : toujours `img.hellofresh.com`, jamais
  `d3hvwccx09j84u.cloudfront.net` (domaine mort).
