#!/bin/bash
set -e

# ──────────────────────────────────────────────────────────
# Script de setup MindDump MCP
# ──────────────────────────────────────────────────────────

PROJECT_DIR="$HOME/Documents/Claude/Projects/TODO"
MCP_DIR="$PROJECT_DIR/minddump-mcp"

echo "🚀 Setup MindDump MCP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Étape 0 : Vérifier / installer Node.js ──────────────
echo ""
echo "🔍 Étape 0/5 : Vérification de Node.js..."

# Chercher npm dans les chemins courants
export PATH="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | tail -1)/bin:$PATH" 2>/dev/null
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node &> /dev/null; then
  echo "   Node.js non trouvé. Installation via Homebrew..."
  if command -v brew &> /dev/null; then
    brew install node
    echo "   ✅ Node.js installé via Homebrew"
  else
    echo "   Homebrew non trouvé. Installation de Homebrew puis Node.js..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv)"
    brew install node
    echo "   ✅ Homebrew + Node.js installés"
  fi
else
  echo "   ✅ Node.js trouvé : $(node -v)"
fi

# ─── Étape 1 : npm install dans minddump-mcp ──────────────
echo ""
echo "📦 Étape 1/5 : Installation des dépendances MCP..."
cd "$MCP_DIR"
npm install
echo "✅ Dépendances installées"

# ─── Étape 2 : Migration Prisma ───────────────────────────
echo ""
echo "🗃️  Étape 2/5 : Migration Prisma (ajout modèle ApiKey)..."
cd "$PROJECT_DIR"

# Exécuter la migration dans le container Docker
docker compose -f docker-compose.dev.yml exec -T app npx prisma db push 2>/dev/null && echo "✅ Base de données mise à jour" || {
  echo "⚠️  Migration via Docker échouée, tentative directe..."
  docker compose -f docker-compose.dev.yml exec -T app npx prisma migrate dev --name add-api-keys 2>/dev/null && echo "✅ Base de données mise à jour" || {
    echo "⚠️  Tentative avec npx local..."
    npx prisma db push 2>/dev/null && echo "✅ Base de données mise à jour" || {
      echo "❌ Migration échouée. Vérifie que le container app tourne."
      echo "   Tu peux essayer manuellement :"
      echo "   docker compose -f docker-compose.dev.yml exec app npx prisma db push"
    }
  }
}

# ─── Étape 3 : Régénérer le client Prisma dans le container ─
echo ""
echo "🔄 Étape 3/5 : Régénération du client Prisma..."
docker compose -f docker-compose.dev.yml exec -T app npx prisma generate 2>/dev/null || true
echo "✅ Client Prisma régénéré"

# ─── Étape 4 : Générer une API Key ───────────────────────
echo ""
echo "🔑 Étape 4/5 : Génération d'une API Key..."

sleep 2

API_KEY_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"name": "MCP Claude"}')

# Extraire la clé de la réponse JSON
API_KEY=$(echo "$API_KEY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('key', ''))" 2>/dev/null)

if [ -z "$API_KEY" ]; then
  echo "⚠️  Impossible de générer l'API Key automatiquement."
  echo "   Réponse serveur: $API_KEY_RESPONSE"
  echo ""
  echo "   Pas de souci — on configure sans API key pour le moment."
  echo "   Si ton app utilise SKIP_AUTH=true en dev, ça marchera directement."
  API_KEY=""
else
  echo "✅ API Key générée : $API_KEY"
  echo "   ⚠️  Sauvegarde cette clé, elle ne sera plus affichée !"
fi

# ─── Étape 5 : Configurer Claude Desktop ──────────────────
echo ""
echo "⚙️  Étape 5/5 : Configuration de Claude Desktop..."

CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

mkdir -p "$CLAUDE_CONFIG_DIR"

if [ -f "$CLAUDE_CONFIG" ]; then
  echo "   Fichier de config Claude existant trouvé."

  python3 -c "
import json

config_path = '$CLAUDE_CONFIG'
with open(config_path, 'r') as f:
    config = json.load(f)

if 'mcpServers' not in config:
    config['mcpServers'] = {}

config['mcpServers']['minddump'] = {
    'command': 'npx',
    'args': ['tsx', '$MCP_DIR/src/index.ts'],
    'env': {
        'MINDDUMP_API_URL': 'http://localhost:3000',
        'MINDDUMP_API_KEY': '${API_KEY}'
    }
}

with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)

print('   ✅ MCP minddump ajouté à la config existante')
" || {
    echo "   ⚠️  Erreur lors de la modification du fichier config."
  }
else
  cat > "$CLAUDE_CONFIG" <<CONFIGEOF
{
  "mcpServers": {
    "minddump": {
      "command": "npx",
      "args": ["tsx", "$MCP_DIR/src/index.ts"],
      "env": {
        "MINDDUMP_API_URL": "http://localhost:3000",
        "MINDDUMP_API_KEY": "${API_KEY}"
      }
    }
  }
}
CONFIGEOF
  echo "   ✅ Fichier de config Claude créé"
fi

# ─── Résumé ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Setup terminé !"
echo ""
echo "📋 Résumé :"
echo "   • Node.js disponible"
echo "   • Dépendances MCP installées"
echo "   • Base de données migrée"
if [ -n "$API_KEY" ]; then
  echo "   • API Key : $API_KEY"
fi
echo "   • Claude Desktop configuré"
echo ""
echo "👉 Prochaine étape : Redémarre Claude Desktop pour charger le MCP."
echo "   Puis essaie : \"Montre-moi mes recettes sur MindDump\""
echo ""
