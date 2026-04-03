#!/bin/sh
set -e

echo "Running Prisma db push to ensure database schema is up to date..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "Warning: prisma db push failed, continuing anyway..."

echo "Starting Next.js server..."
exec node server.js
