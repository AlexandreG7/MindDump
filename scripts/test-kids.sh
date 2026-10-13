#!/bin/sh
# Test du semainier à rubriques choisies par la famille (docs/semainier/02-plan-technique.md).
#
# Rejoue ce qui se passe au déploiement, sur une base PostgreSQL JETABLE :
#   1. une base au SCHÉMA DE PRODUCTION (toutes les migrations sauf celle des rubriques),
#      avec des saisies existantes de l'ancien semainier ;
#   2. la migration (expand) puis un serveur construit (next build) ;
#   3. une lecture AVANT la reprise (lecture tolérante), puis prisma/backfill-kid-trackers.js ;
#   4. la preuve que rien n'est perdu, que la reprise est rejouable sans effet, puis les
#      parcours de l'API (accès, masquage, concurrence, ancien PATCH, export, suppression).
# N'utilise jamais DATABASE_URL de l'environnement : aucune chance d'écrire en prod.
#
# Utilisé par le stage « test » du Dockerfile : un échec bloque le déploiement.
# En local, après `npm run build` : npm run test:kids
# Sans initdb en local : KIDS_TEST_DATABASE_URL=postgresql://…/minddump_xxx_test
# (le nom de la base doit contenir « test » ; son schéma public est réinitialisé).
set -eu

# Migration des rubriques : retirée pour rejouer l'état de production d'avant.
NEW_MIGRATION="20261013100000_kid_trackers"

PORT_DB="${KIDS_TEST_DB_PORT:-54343}"
PORT_APP="${KIDS_TEST_APP_PORT:-3994}"
WORK="$(mktemp -d)"
PGDATA="$WORK/pgdata"
SERVER_PID=""
EXTERNAL_DB="${KIDS_TEST_DATABASE_URL:-}"
PG_BIN="${PG_BIN:-}"
PRISMA="node ./node_modules/prisma/build/index.js"

# initdb refuse de tourner en root.
as_pg() {
  if [ "$(id -u)" = "0" ]; then su -s /bin/sh postgres -c "$1"; else sh -c "$1"; fi
}

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  if [ -z "$EXTERNAL_DB" ]; then
    as_pg "$PG_BIN/pg_ctl -D '$PGDATA' -m immediate stop" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

if [ -n "$EXTERNAL_DB" ]; then
  case "$EXTERNAL_DB" in
    *test*) ;;
    *) echo "Refus : KIDS_TEST_DATABASE_URL doit viser une base de test."; exit 2 ;;
  esac
  export DATABASE_URL="$EXTERNAL_DB"
  echo 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' | $PRISMA db execute --stdin --schema prisma/schema.prisma >/dev/null
else
  PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -n 1)")}"
  [ "$(id -u)" = "0" ] && chown postgres "$WORK"
  as_pg "$PG_BIN/initdb -D '$PGDATA' -A trust -U postgres" >/dev/null
  as_pg "$PG_BIN/pg_ctl -D '$PGDATA' -o '-p $PORT_DB -k $WORK -c listen_addresses=localhost' -l '$WORK/pg.log' -w start" >/dev/null
  as_pg "$PG_BIN/createdb -h localhost -p $PORT_DB -U postgres minddump_kids_test"
  export DATABASE_URL="postgresql://postgres@localhost:$PORT_DB/minddump_kids_test"
fi
export OWNERSHIP_TEST_DB=disposable
export KIDS_TEST_STATE="$WORK/state.json"
export NEXTAUTH_SECRET="kids-test-secret"
export NEXTAUTH_URL="http://127.0.0.1:$PORT_APP"
export BASE_URL="http://127.0.0.1:$PORT_APP"
unset SKIP_AUTH || true

TSX=./node_modules/.bin/tsx

echo "== Base au schéma de production (sans $NEW_MIGRATION)"
mkdir -p "$WORK/prisma-old/migrations"
cp prisma/schema.prisma "$WORK/prisma-old/"
for dir in prisma/migrations/*/; do
  name="$(basename "$dir")"
  [ "$name" = "$NEW_MIGRATION" ] && continue
  cp -R "$dir" "$WORK/prisma-old/migrations/$name"
done
cp prisma/migrations/migration_lock.toml "$WORK/prisma-old/migrations/"
$PRISMA migrate deploy --schema "$WORK/prisma-old/schema.prisma" >/dev/null
$TSX tests/kids.test.mjs seed

echo "== Migration (expand) telle que l'entrypoint la joue"
$PRISMA migrate deploy | tail -n 3
$TSX tests/kids.test.mjs migrated

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

fail() {
  echo "--- journal du serveur ---"; tail -n 50 "$WORK/app.log"
  exit 1
}

$TSX tests/kids.test.mjs lazy || fail

echo "== Reprise au démarrage (prisma/backfill-kid-trackers.js)"
node prisma/backfill-kid-trackers.js | tee "$WORK/backfill1.log"
$TSX tests/kids.test.mjs verify || fail

echo "== Rejouabilité : un 2e démarrage ne change rien"
$TSX tests/kids.test.mjs snapshot > "$WORK/snap1.json"
node prisma/backfill-kid-trackers.js | tee "$WORK/backfill2.log"
$TSX tests/kids.test.mjs snapshot > "$WORK/snap2.json"
if [ -s "$WORK/backfill2.log" ]; then echo "FAIL le 2e passage a écrit : $(cat "$WORK/backfill2.log")"; exit 1; fi
if cmp -s "$WORK/snap1.json" "$WORK/snap2.json"; then
  echo "  ok   2e passage : aucune écriture, base identique octet pour octet ($(wc -c < "$WORK/snap1.json" | tr -d ' ') octets d'état comparés)"
else
  echo "  FAIL la base a changé au 2e passage"; exit 1
fi

echo "== API"
$TSX tests/kids.test.mjs api || fail
