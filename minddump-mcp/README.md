# MindDump MCP Server

Serveur MCP pour connecter Claude à ton app MindDump. Permet de gérer recettes, tâches, listes de courses et calendrier directement depuis Claude.

## Tools disponibles

| Tool | Description |
|------|-------------|
| `create_recipe` | Créer une recette (photo → extraction → sauvegarde) |
| `list_recipes` | Lister toutes les recettes |
| `get_recipe` | Voir le détail d'une recette |
| `set_recipe_photo` | Ajouter / remplacer la photo d'une recette (URL, base64 ou fichier local) |
| `recipe_to_shopping_list` | Convertir une recette en liste de courses |
| `create_todo` | Ajouter une tâche à faire |
| `list_todos` | Lister les tâches |
| `complete_todo` | Marquer une tâche comme terminée |
| `update_todo` | Modifier une tâche |
| `create_shopping_list` | Créer une liste de courses |
| `list_shopping_lists` | Lister les listes de courses |
| `add_to_shopping_list` | Ajouter des articles à une liste |
| `get_shopping_list` | Voir le détail d'une liste |
| `list_groups` | Lister les groupes (pour le partage) |
| `create_event` | Ajouter un rendez-vous ou une échéance au calendrier |
| `list_events` | Lister les événements d'un mois (calendriers abonnés compris) |
| `update_event` | Déplacer ou modifier un événement |
| `delete_event` | Supprimer un événement |

## Installation

```bash
cd minddump-mcp
npm install
```

## Configuration

### 1. Générer une API Key

Depuis ton app MindDump (doit être lancée) :

```bash
curl -X POST http://localhost:3000/api/auth/api-key \
  -H "Content-Type: application/json" \
  -H "Cookie: <ton-cookie-de-session>" \
  -d '{"name": "MCP Claude"}'
```

Ou utilise `SKIP_AUTH=true` en dev pour bypasser l'auth.

### 2. Configurer Claude Desktop

Ajoute dans `~/Library/Application Support/Claude/claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "minddump": {
      "command": "npx",
      "args": ["tsx", "/chemin/absolu/vers/minddump-mcp/src/index.ts"],
      "env": {
        "MINDDUMP_API_URL": "http://localhost:3000",
        "MINDDUMP_API_KEY": "mdk_ta-cle-ici"
      }
    }
  }
}
```

### 3. Configurer Claude Code

Ajoute dans `.mcp.json` à la racine du projet :

```json
{
  "mcpServers": {
    "minddump": {
      "command": "npx",
      "args": ["tsx", "./minddump-mcp/src/index.ts"],
      "env": {
        "MINDDUMP_API_URL": "http://localhost:3000",
        "MINDDUMP_API_KEY": "mdk_ta-cle-ici"
      }
    }
  }
}
```

## Exemples d'utilisation avec Claude

- **Photo de recette** : "Voici une photo de recette, extrais-la et sauvegarde-la dans MindDump"
- **Photo du plat** : "Mets la photo ~/Desktop/lasagnes.jpg sur ma recette de lasagnes" (`imagePath` : MCP local uniquement ; en mode SSE, utiliser `imageUrl` ou `imageBase64`)
- **Ajouter des courses** : "Ajoute du lait, des oeufs et du beurre à ma liste de courses"
- **Créer une tâche** : "Rappelle à la famille de sortir les poubelles demain"
- **Planifier des repas** : "Montre-moi mes recettes et crée une liste de courses pour la recette de lasagnes"
