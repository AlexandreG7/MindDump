#!/bin/bash
# Prépare une session Claude Code cloud : dépendances de l'app et du serveur MCP
# (le postinstall lance `prisma generate`). PostgreSQL 16 est fourni par l'image :
# scripts/test-*.sh créent eux-mêmes leur base jetable.
# `npm ci` ne réécrit pas package-lock.json ; on l'évite quand node_modules est à jour.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

install() {
  if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    npm ci --no-audit --no-fund
  fi
}

cd "$CLAUDE_PROJECT_DIR"
install
(cd minddump-mcp && install)
