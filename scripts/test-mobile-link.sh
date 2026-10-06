#!/bin/sh
# Test de non-régression de la liaison d'un compte Google/Apple depuis l'app
# mobile (src/lib/mobileLink.ts, docs/oauth.md « Connexion depuis l'app mobile ») :
# un ticket ne lie que l'utilisateur qui l'a demandé, une seule fois, sans jamais
# créer de session ni d'utilisateur.
#
# Même principe que scripts/test-ownership.sh : base PostgreSQL JETABLE, serveur
# construit (next build), tests/mobile-link.test.mjs par HTTP. Google est activé
# avec de faux identifiants (jamais contactés : le retour OAuth est simulé).
# N'utilise jamais DATABASE_URL de l'environnement : aucune chance d'écrire en prod.
#
# Utilisé par le stage « test » du Dockerfile : un échec bloque le déploiement.
# En local, après `npm run build` : npm run test:mobile-link
set -eu

PORT_DB="${MOBILE_LINK_TEST_DB_PORT:-54340}"
PORT_APP="${MOBILE_LINK_TEST_APP_PORT:-3997}"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -n 1)")}"
WORK="$(mktemp -d)"
PGDATA="$WORK/pgdata"
SERVER_PID=""

# initdb refuse de tourner en root.
as_pg() {
  if [ "$(id -u)" = "0" ]; then su -s /bin/sh postgres -c "$1"; else sh -c "$1"; fi
}

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  as_pg "$PG_BIN/pg_ctl -D '$PGDATA' -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

[ "$(id -u)" = "0" ] && chown postgres "$WORK"
as_pg "$PG_BIN/initdb -D '$PGDATA' -A trust -U postgres" >/dev/null
as_pg "$PG_BIN/pg_ctl -D '$PGDATA' -o '-p $PORT_DB -k $WORK -c listen_addresses=localhost' -l '$WORK/pg.log' -w start" >/dev/null
as_pg "$PG_BIN/createdb -h localhost -p $PORT_DB -U postgres minddump_mobile_link_test"

export DATABASE_URL="postgresql://postgres@localhost:$PORT_DB/minddump_mobile_link_test"
export OWNERSHIP_TEST_DB=disposable
export GOOGLE_CLIENT_ID="test-not-used"
export GOOGLE_CLIENT_SECRET="test-not-used"
unset OAUTH_TEST_ISSUER || true
export NEXTAUTH_SECRET="mobile-link-test-secret"
export NEXTAUTH_URL="http://127.0.0.1:$PORT_APP"
export BASE_URL="http://127.0.0.1:$PORT_APP"
unset SKIP_AUTH || true

node ./node_modules/prisma/build/index.js migrate deploy >/dev/null

if [ -f .next/standalone/server.js ]; then
  PORT="$PORT_APP" HOSTNAME=127.0.0.1 node .next/standalone/server.js >"$WORK/app.log" 2>&1 &
else
  node ./node_modules/next/dist/bin/next start -p "$PORT_APP" >"$WORK/app.log" 2>&1 &
fi
SERVER_PID=$!

i=0
until node -e "fetch('$BASE_URL/api/recipes').then(()=>process.exit(0),()=>process.exit(1))" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "Le serveur ne répond pas :"; cat "$WORK/app.log"; exit 1
  fi
  sleep 1
done

if ! ./node_modules/.bin/tsx tests/mobile-link.test.mjs; then
  echo "--- journal du serveur ---"; tail -n 50 "$WORK/app.log"
  exit 1
fi
