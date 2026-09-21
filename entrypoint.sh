#!/bin/sh
set -e

PRISMA="node ./node_modules/prisma/build/index.js"
BACKUP_DIR="${BACKUP_DIR:-/app/data/backups}"

# ─── Migrations : priorité absolue aux données ────────────────────────────────
# Principe : en cas de doute, on NE démarre PAS (l'ancienne version reste en
# place, les données restent intactes) plutôt que de toucher à la base.
# Voir docs/migrations-prisma.md.

# Sauvegarde complète (SQL compressé) dans un volume persistant, vérifiée avant
# de continuer. Obligatoire avant toute migration.
backup_database() {
  if ! grep -qs " $BACKUP_DIR " /proc/mounts && [ "$ALLOW_EPHEMERAL_BACKUPS" != "true" ]; then
    echo "Error: $BACKUP_DIR is not a persistent volume: a backup there would be lost on the next deploy."
    echo "Mount a volume on $BACKUP_DIR (Coolify: Persistent Storage), then redeploy."
    return 1
  fi
  mkdir -p "$BACKUP_DIR"
  FILE="$BACKUP_DIR/minddump-$(date -u +%Y%m%d-%H%M%S).sql.gz"
  echo "Backing up database to $FILE..."
  # libpq refuse le paramètre ?schema=... propre à Prisma.
  if ! pg_dump --no-owner --no-privileges "${DATABASE_URL%%\?*}" | gzip > "$FILE.partial"; then
    rm -f "$FILE.partial"
    return 1
  fi
  # Sauvegarde valide = archive gzip intacte ET dump arrivé à son terme.
  if ! gzip -t "$FILE.partial" || ! gunzip -c "$FILE.partial" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
    echo "Error: backup file is incomplete or corrupted."
    rm -f "$FILE.partial"
    return 1
  fi
  mv "$FILE.partial" "$FILE"
  echo "Backup OK ($(du -h "$FILE" | cut -f1))."
  node prisma/rotate-backups.js "$BACKUP_DIR"
}

# Base créée à l'époque de `db push`, sans historique de migrations (P3005).
# On calcule l'écart réel entre la base et le schéma : s'il ne contient que des
# ajouts, on l'applique dans une transaction et on marque les migrations comme
# appliquées ; au moindre ordre destructeur, on s'arrête sans rien modifier.
baseline_existing_database() {
  echo "Existing database without migration history: computing the schema difference..."
  DIFF=$($PRISMA migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script)
  echo "$DIFF"
  # Ordres destructeurs (lignes de commentaire exclues). "ON DELETE CASCADE"
  # d'une clé étrangère n'en fait pas partie.
  if echo "$DIFF" | grep -v '^[[:space:]]*--' | grep -qiE '(^|[^a-z_])(drop|rename|truncate)([^a-z_]|$)|delete[[:space:]]+from|alter[[:space:]]+column'; then
    echo "Error: the difference contains destructive statements (see above). Nothing was changed."
    echo "Manual intervention required (docs/migrations-prisma.md)."
    return 1
  fi
  printf 'BEGIN;\n%s\nCOMMIT;\n' "$DIFF" | $PRISMA db execute --stdin --schema prisma/schema.prisma
  for dir in prisma/migrations/*/; do
    $PRISMA migrate resolve --applied "$(basename "$dir")"
  done
}

echo "Checking database migrations..."
if STATUS=$($PRISMA migrate status 2>&1); then
  echo "Database schema is up to date."
else
  echo "$STATUS"
  if echo "$STATUS" | grep -qi "failed"; then
    # Jamais de nouvelle tentative automatique sur une migration en échec.
    echo "Error: a previous migration failed. Manual intervention required (docs/migrations-prisma.md)."
    exit 1
  fi
  backup_database || { echo "Error: backup failed, migrations NOT applied. Aborting startup."; exit 1; }
  if ! OUTPUT=$($PRISMA migrate deploy 2>&1); then
    echo "$OUTPUT"
    if echo "$OUTPUT" | grep -q "P3005"; then
      baseline_existing_database || exit 1
      $PRISMA migrate deploy
    else
      echo "Error: prisma migrate deploy failed. Aborting startup."
      exit 1
    fi
  else
    echo "$OUTPUT"
  fi
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
