#!/bin/sh
# Test de non-régression des rappels locaux de l'app mobile
# (GET /api/reminders/upcoming, src/lib/reminders.ts) : même règle de
# destinataires que le push web / e-mail (src/lib/notify.ts), voir
# docs/adr/0001-les-elements-restent-attaches-a-leur-auteur.md.
#
# Même principe que scripts/test-ownership.sh : base PostgreSQL JETABLE,
# serveur construit (next build), tests/reminders.test.mjs par HTTP.
# N'utilise jamais DATABASE_URL de l'environnement : aucune chance d'écrire en prod.
#
# Utilisé par le stage « test » du Dockerfile : un échec bloque le déploiement.
# En local, après `npm run build` : npm run test:reminders
set -eu

PORT_DB="${REMINDERS_TEST_DB_PORT:-54339}"
PORT_APP="${REMINDERS_TEST_APP_PORT:-3998}"
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
as_pg "$PG_BIN/createdb -h localhost -p $PORT_DB -U postgres minddump_reminders_test"

export DATABASE_URL="postgresql://postgres@localhost:$PORT_DB/minddump_reminders_test"
export OWNERSHIP_TEST_DB=disposable
export NEXTAUTH_SECRET="reminders-test-secret"
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

if ! node tests/reminders.test.mjs; then
  echo "--- journal du serveur ---"; tail -n 50 "$WORK/app.log"
  exit 1
fi
