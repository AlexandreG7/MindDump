# Plan MCP MindDump

## Objectif

Créer un serveur MCP (Model Context Protocol) qui permet à Claude d'interagir directement avec la base de données de MindDump. Cas d'usage principaux :

1. **Recettes** — Prendre en photo une recette, Claude l'extrait et la sauvegarde dans MindDump
2. **Todos** — Ajouter des tâches à faire depuis une conversation avec Claude
3. **Listes de courses** — Ajouter des articles dans une liste de courses existante ou en créer une nouvelle

---

## Architecture retenue

### Option recommandée : MCP → API HTTP de MindDump

Le MCP agit comme un **client HTTP** qui appelle les API REST existantes de ton app. C'est l'approche la plus propre pour plusieurs raisons :

- **Pas de duplication de logique** — tu réutilises toute la validation, l'auth, et la logique métier déjà dans tes routes Next.js
- **Découplage total** — le MCP ne dépend pas de Prisma, pas de connexion directe à PostgreSQL
- **Déployable n'importe où** — le MCP peut tourner en local sur ta machine, indépendamment du serveur Next.js
- **Sécurité** — l'authentification passe par les mêmes mécanismes (API key ou session token)

```
┌─────────┐     MCP Protocol      ┌──────────────┐    HTTP/REST    ┌─────────────┐
│  Claude  │ ◄──────────────────► │  MCP Server  │ ──────────────► │  MindDump   │
│ (Client) │   (stdio ou SSE)     │  (Node.js)   │   (fetch)       │  (Next.js)  │
└─────────┘                       └──────────────┘                 └──────┬──────┘
                                                                          │
                                                                    ┌─────▼─────┐
                                                                    │ PostgreSQL │
                                                                    └───────────┘
```

### Alternative (plus rapide mais plus couplée) : MCP → Prisma direct

Le MCP importerait Prisma et parlerait directement à PostgreSQL. Plus rapide à prototyper mais couple fortement le MCP à ton schéma DB et bypass toute ta logique métier. **Je ne le recommande pas** sauf si tu veux un POC rapide en local uniquement.

---

## Authentification pour le MCP

Ton app utilise NextAuth avec des sessions JWT. Pour le MCP, il y a deux approches :

### Approche 1 : API Key dédiée (recommandée)

Ajouter une route `/api/mcp/auth` ou un mécanisme d'API key :

1. Ajouter un champ `apiKey` au modèle `User` dans Prisma (ou une table `ApiKey` séparée)
2. Créer un middleware qui accepte un header `Authorization: Bearer <api-key>` en plus des sessions NextAuth
3. Le MCP stocke cette clé dans sa config

**Changements dans MindDump :**
- Nouveau champ dans le schéma Prisma : `ApiKey { id, key, userId, createdAt }`
- Modifier `getSessionUser()` dans `session.ts` pour aussi vérifier le header `Authorization` et lookup l'API key
- Ajouter une page dans le profil pour générer/révoquer des API keys

### Approche 2 : Variable d'env SKIP_AUTH (dev only)

Tu as déjà `SKIP_AUTH=true` qui bypass l'auth et utilise un `dev-user` fixe. Pour du dev local uniquement, c'est suffisant — le MCP appelle l'API sans auth. **Ne pas utiliser en prod.**

---

## Les tools MCP à implémenter

### 1. `create_recipe` — Créer une recette

C'est le tool principal pour le cas "photo → recette". Claude extrait les infos de la photo et appelle ce tool.

```typescript
{
  name: "create_recipe",
  description: "Créer une nouvelle recette dans MindDump",
  inputSchema: {
    type: "object",
    properties: {
      title:       { type: "string", description: "Nom de la recette" },
      description: { type: "string", description: "Description courte" },
      servings:    { type: "number", description: "Nombre de portions (défaut: 4)" },
      prepTime:    { type: "number", description: "Temps de préparation en minutes" },
      cookTime:    { type: "number", description: "Temps de cuisson en minutes" },
      steps:       { type: "array", items: { type: "string" }, description: "Étapes de la recette" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name:     { type: "string" },
            quantity: { type: "string" },
            unit:     { type: "string" }
          },
          required: ["name", "quantity"]
        }
      },
      groupId:  { type: "string", description: "ID du groupe (optionnel)" },
      planned:  { type: "boolean", description: "Marquer comme planifiée" }
    },
    required: ["title", "ingredients", "steps"]
  }
}
// → POST /api/recipes
```

### 2. `list_recipes` — Lister les recettes

```typescript
{
  name: "list_recipes",
  description: "Lister toutes les recettes de MindDump",
  inputSchema: {
    type: "object",
    properties: {
      groupId: { type: "string", description: "Filtrer par groupe (optionnel)" }
    }
  }
}
// → GET /api/recipes?groupId=...
```

### 3. `create_todo` — Ajouter une tâche

```typescript
{
  name: "create_todo",
  description: "Ajouter une tâche à faire dans MindDump",
  inputSchema: {
    type: "object",
    properties: {
      title:        { type: "string", description: "Titre de la tâche" },
      description:  { type: "string", description: "Description détaillée" },
      priority:     { type: "string", enum: ["URGENT", "PLANNED"], description: "Priorité" },
      dueDate:      { type: "string", description: "Date d'échéance (ISO 8601)" },
      notifyBefore: { type: "number", description: "Minutes avant pour notifier" },
      groupId:      { type: "string", description: "ID du groupe (optionnel)" }
    },
    required: ["title"]
  }
}
// → POST /api/todos
```

### 4. `list_todos` — Lister les tâches

```typescript
{
  name: "list_todos",
  description: "Lister les tâches à faire",
  inputSchema: {
    type: "object",
    properties: {
      groupId: { type: "string" }
    }
  }
}
// → GET /api/todos?groupId=...
```

### 5. `complete_todo` — Marquer une tâche comme faite

```typescript
{
  name: "complete_todo",
  description: "Marquer une tâche comme terminée",
  inputSchema: {
    type: "object",
    properties: {
      todoId: { type: "string", description: "ID de la tâche" }
    },
    required: ["todoId"]
  }
}
// → PATCH /api/todos/{id} { completed: true }
```

### 6. `add_to_shopping_list` — Ajouter des articles à une liste de courses

```typescript
{
  name: "add_to_shopping_list",
  description: "Ajouter un ou plusieurs articles à une liste de courses",
  inputSchema: {
    type: "object",
    properties: {
      listId: { type: "string", description: "ID de la liste existante" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name:     { type: "string" },
            quantity: { type: "string" },
            category: { type: "string" }
          },
          required: ["name"]
        }
      }
    },
    required: ["listId", "items"]
  }
}
// → POST /api/lists/{id}/items (supporte déjà les arrays!)
```

### 7. `create_shopping_list` — Créer une nouvelle liste

```typescript
{
  name: "create_shopping_list",
  description: "Créer une nouvelle liste de courses",
  inputSchema: {
    type: "object",
    properties: {
      name:    { type: "string", description: "Nom de la liste" },
      type:    { type: "string", enum: ["GROCERY", "ONLINE"] },
      groupId: { type: "string" }
    },
    required: ["name"]
  }
}
// → POST /api/lists
```

### 8. `list_shopping_lists` — Voir les listes de courses

```typescript
{
  name: "list_shopping_lists",
  description: "Lister les listes de courses avec leurs articles",
  inputSchema: {
    type: "object",
    properties: {
      groupId: { type: "string" }
    }
  }
}
// → GET /api/lists?groupId=...
```

### 9. `list_groups` — Lister les groupes

Utile pour que Claude puisse proposer dans quel groupe enregistrer une recette/todo/liste.

```typescript
{
  name: "list_groups",
  description: "Lister les groupes dont l'utilisateur est membre",
  inputSchema: { type: "object", properties: {} }
}
// → GET /api/groups
```

### 10. `recipe_to_shopping_list` — Convertir une recette en liste de courses

Ton app a déjà cette fonctionnalité !

```typescript
{
  name: "recipe_to_shopping_list",
  description: "Convertir les ingrédients d'une recette en liste de courses",
  inputSchema: {
    type: "object",
    properties: {
      recipeId: { type: "string", description: "ID de la recette" }
    },
    required: ["recipeId"]
  }
}
// → POST /api/recipes/{id}/to-list
```

---

## Structure du projet MCP

```
minddump-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Point d'entrée — serveur MCP stdio
│   ├── config.ts             # Configuration (URL de l'API, API key)
│   ├── client.ts             # Client HTTP pour appeler l'API MindDump
│   └── tools/
│       ├── recipes.ts        # create_recipe, list_recipes, recipe_to_shopping_list
│       ├── todos.ts          # create_todo, list_todos, complete_todo
│       ├── shopping.ts       # create_shopping_list, add_to_shopping_list, list_shopping_lists
│       └── groups.ts         # list_groups
├── .env                      # MINDDUMP_API_URL, MINDDUMP_API_KEY
└── README.md
```

### Dépendances

- `@modelcontextprotocol/sdk` — Le SDK officiel MCP
- `zod` — Validation des schémas (utilisé par le SDK MCP)
- `typescript` + `tsx` — Dev & build

---

## Plan d'implémentation en 5 étapes

### Étape 1 — Préparer l'auth côté MindDump (30 min)

1. Ajouter le modèle `ApiKey` dans `prisma/schema.prisma`
2. Modifier `getSessionUser()` dans `src/lib/session.ts` pour supporter le header `Authorization: Bearer <api-key>`
3. Créer une route `POST /api/auth/api-key` pour générer une clé
4. `npx prisma migrate dev`

**Alternative rapide :** utiliser `SKIP_AUTH=true` pour commencer, et ajouter l'API key après.

### Étape 2 — Scaffolder le MCP (20 min)

1. `mkdir minddump-mcp && cd minddump-mcp`
2. `npm init -y && npm install @modelcontextprotocol/sdk zod`
3. Créer la structure de fichiers
4. Implémenter `config.ts` et `client.ts` (wrapper fetch avec auth)

### Étape 3 — Implémenter les tools (1h30)

Ordre de priorité :
1. `list_groups` (le plus simple, permet de tester la connexion)
2. `create_recipe` + `list_recipes` (ton cas d'usage principal)
3. `create_todo` + `list_todos` + `complete_todo`
4. `create_shopping_list` + `add_to_shopping_list` + `list_shopping_lists`
5. `recipe_to_shopping_list`

### Étape 4 — Configurer Claude Desktop / Claude Code (10 min)

Ajouter dans `claude_desktop_config.json` ou `.mcp.json` :

```json
{
  "mcpServers": {
    "minddump": {
      "command": "npx",
      "args": ["tsx", "/chemin/vers/minddump-mcp/src/index.ts"],
      "env": {
        "MINDDUMP_API_URL": "http://localhost:3000",
        "MINDDUMP_API_KEY": "ta-cle-api"
      }
    }
  }
}
```

### Étape 5 — Tester le workflow complet (30 min)

1. Démarrer MindDump (`docker compose up`)
2. Vérifier que Claude voit les tools MCP
3. Tester : "Montre-moi mes groupes" → `list_groups`
4. Tester : envoyer une photo de recette → Claude extrait → `create_recipe`
5. Tester : "Ajoute du lait et des oeufs à ma liste de courses" → `add_to_shopping_list`
6. Tester : "J'ai besoin de rappeler à la famille de sortir les poubelles demain" → `create_todo`

---

## Améliorations futures possibles

- **`update_recipe`** — Modifier une recette existante
- **`create_calendar_event`** — Ajouter des événements au calendrier familial
- **`search_recipes`** — Recherche par nom ou ingrédient
- **Resources MCP** — Exposer les recettes comme des resources consultables (pas seulement des tools)
- **Transport SSE** — Pour un déploiement serveur distant (au lieu de stdio local)
- **Upload d'image de recette** — `POST /api/recipes/{id}/image` après création

---

## Estimation totale : ~3h pour un MCP fonctionnel

| Étape | Durée estimée |
|-------|---------------|
| Auth côté MindDump | 30 min |
| Scaffold MCP | 20 min |
| Implémenter les tools | 1h30 |
| Config Claude | 10 min |
| Tests E2E | 30 min |
| **Total** | **~3h** |
