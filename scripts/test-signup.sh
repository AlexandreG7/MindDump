#!/bin/sh
# Test de non-régression des inscriptions fermées : adresses autorisées en base (table
# AllowedSignupEmail, src/lib/signupAllowlist.ts, docs/oauth.md « Bêta privée »), bêta privée sur
# invitation (demandes d'accès, liens à usage unique, admin : tests/beta.test.mjs) et invitations de
# foyer qui ouvrent l'inscription et rejoignent un groupe (tests/group-invite.test.mjs). Personne hors
# de la table ou sans invitation valide ne crée de compte (e-mail/mot de passe, Google/Apple), mais les
# comptes existants se connectent et lient un fournisseur comme avant (ADR 0001).
#
# Même principe que scripts/test-mobile-link.sh : base PostgreSQL JETABLE, un serveur construit
# (next build), table d'adresses vide au départ, puis tests/signup.test.mjs par HTTP et par appel
# direct des callbacks NextAuth.
# N'utilise jamais DATABASE_URL de l'environnement : aucune chance d'écrire en prod.
#
# Utilisé par le stage « test » du Dockerfile : un échec bloque le déploiement.
# En local, après `npm run build` : npm run test:signup
# Sans initdb en local : SIGNUP_TEST_DATABASE_URL=postgresql://…/minddump_signup_test
# (le nom de la base doit contenir « test »).
set -eu

PORT_DB="${SIGNUP_TEST_DB_PORT:-54341}"
PORT_APP="${SIGNUP_TEST_APP_PORT:-3996}"
WORK="$(mktemp -d)"
PGDATA="$WORK/pgdata"
PIDS=""
EXTERNAL_DB="${SIGNUP_TEST_DATABASE_URL:-}"
PG_BIN="${PG_BIN:-}"

# initdb refuse de tourner en root.
as_pg() {
  if [ "$(id -u)" = "0" ]; then su -s /bin/sh postgres -c "$1"; else sh -c "$1"; fi
}

cleanup() {
  for pid in $PIDS; do kill "$pid" 2>/dev/null || true; done
  if [ -z "$EXTERNAL_DB" ]; then
    as_pg "$PG_BIN/pg_ctl -D '$PGDATA' -m immediate stop" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

if [ -n "$EXTERNAL_DB" ]; then
  case "$EXTERNAL_DB" in
    *test*) ;;
    *) echo "Refus : SIGNUP_TEST_DATABASE_URL doit viser une base de test."; exit 2 ;;
  esac
  export DATABASE_URL="$EXTERNAL_DB"
else
  PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -n 1)")}"
  [ "$(id -u)" = "0" ] && chown postgres "$WORK"
  as_pg "$PG_BIN/initdb -D '$PGDATA' -A trust -U postgres" >/dev/null
  as_pg "$PG_BIN/pg_ctl -D '$PGDATA' -o '-p $PORT_DB -k $WORK -c listen_addresses=localhost' -l '$WORK/pg.log' -w start" >/dev/null
  as_pg "$PG_BIN/createdb -h localhost -p $PORT_DB -U postgres minddump_signup_test"
  export DATABASE_URL="postgresql://postgres@localhost:$PORT_DB/minddump_signup_test"
fi
export OWNERSHIP_TEST_DB=disposable
export GOOGLE_CLIENT_ID="test-not-used"
export GOOGLE_CLIENT_SECRET="test-not-used"
unset OAUTH_TEST_ISSUER || true
export NEXTAUTH_SECRET="signup-test-secret"
unset SKIP_AUTH || true

node ./node_modules/prisma/build/index.js migrate deploy >/dev/null

# Le suffixe d'exécution est partagé avec les tests (RUN_ID). Les adresses autorisées sont semées
# par les tests, dans la table (jamais par variable d'environnement : elle n'existe plus).
RUN_ID="$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
export SIGNUP_TEST_RUN_ID="$RUN_ID"

start_server() {
  port="$1"; log="$2"
  if [ -f .next/standalone/server.js ]; then
    NEXTAUTH_URL="http://127.0.0.1:$port" PORT="$port" HOSTNAME=127.0.0.1 node .next/standalone/server.js >"$log" 2>&1 &
  else
    NEXTAUTH_URL="http://127.0.0.1:$port" node ./node_modules/next/dist/bin/next start -p "$port" >"$log" 2>&1 &
  fi
  PIDS="$PIDS $!"
  i=0
  until node -e "fetch('http://127.0.0.1:$port/api/recipes').then(()=>process.exit(0),()=>process.exit(1))" 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      echo "Le serveur ne répond pas :"; cat "$log"; exit 1
    fi
    sleep 1
  done
}

start_server "$PORT_APP" "$WORK/app.log"

export BASE_URL="http://127.0.0.1:$PORT_APP"
export NEXTAUTH_URL="$BASE_URL"

if ! ./node_modules/.bin/tsx tests/signup.test.mjs || ! ./node_modules/.bin/tsx tests/beta.test.mjs || ! ./node_modules/.bin/tsx tests/group-invite.test.mjs; then
  echo "--- journal du serveur ---"; tail -n 50 "$WORK/app.log"
  exit 1
fi
