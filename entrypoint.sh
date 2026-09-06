#!/bin/sh
set -e

echo "Running Prisma db push to ensure database schema is up to date..."
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 || echo "Warning: prisma db push failed, continuing anyway..."

echo "Backfilling public IDs..."
node prisma/backfill-public-ids.js

echo "Cleaning up phantom todos..."
node prisma/cleanup-phantom-todos.js

echo "Starting Next.js server..."
exec node server.js
