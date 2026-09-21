#!/bin/sh
set -e

PRISMA="node ./node_modules/prisma/build/index.js"

# Migrations versionnées (prisma/migrations). Une base créée à l'époque de
# `db push` n'a pas d'historique : Prisma refuse alors de migrer (P3005). On la
# marque une seule fois comme étant au niveau de la baseline 0_init, puis on
# applique les migrations suivantes. Voir docs/admin-et-rgpd.md.
echo "Applying Prisma migrations..."
if ! OUTPUT=$($PRISMA migrate deploy 2>&1); then
  echo "$OUTPUT"
  if echo "$OUTPUT" | grep -q "P3005"; then
    echo "Existing database without migration history: baselining 0_init..."
    $PRISMA migrate resolve --applied 0_init
    $PRISMA migrate deploy
  else
    echo "Error: prisma migrate deploy failed, aborting startup."
    exit 1
  fi
else
  echo "$OUTPUT"
fi

echo "Backfilling public IDs..."
node prisma/backfill-public-ids.js

echo "Backfilling inCatalog for existing recipes..."
node prisma/backfill-in-catalog.js

echo "Attaching synced calendars to their group..."
node prisma/backfill-subscription-groups.js

echo "Cleaning up phantom todos..."
node prisma/cleanup-phantom-todos.js

echo "Starting Next.js server..."
exec node server.js
