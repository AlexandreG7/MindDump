#!/bin/sh
# Cron script to trigger notification checks every 5 minutes
# Add to crontab: */5 * * * * /path/to/cron.sh

NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-}"
APP_URL="${NEXTAUTH_URL:-http://localhost:3000}"

curl -s -X POST "${APP_URL}/api/cron/notify" \
  -H "Authorization: Bearer ${NEXTAUTH_SECRET}" \
  -H "Content-Type: application/json"
