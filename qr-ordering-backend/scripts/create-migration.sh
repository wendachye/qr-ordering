#!/usr/bin/env bash
set -euo pipefail

# Generate a migration's SQL by diffing the live dev database against
# prisma/schema.prisma. It WRITES the SQL for review but NEVER applies it —
# applying stays a separate, explicit step (`npm run db:migrate:deploy`), so
# every schema change passes human review before touching a database.
#
# For migrations that need data backfill, hand-edit the generated migration.sql
# to add the backfill statements before deploying.
#
# Usage: npm run db:migrate:create -- <name>
#   e.g. npm run db:migrate:create -- add_member_birthday

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: npm run db:migrate:create -- <name>"
  echo "Example: npm run db:migrate:create -- add_member_birthday"
  exit 1
fi

# Sanitize: lowercase, spaces/dashes -> underscores
NAME=$(echo "$NAME" | tr '[:upper:] -' '[:lower:]__')

TS=$(date +%Y%m%d%H%M%S)
DIR="prisma/migrations/${TS}_${NAME}"

TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

# from = current live DB (datasource url from prisma.config.ts); to = desired schema models.
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > "$TMP_FILE"

if ! grep -qiE "ALTER|CREATE|DROP" "$TMP_FILE"; then
  echo "No schema changes detected. Nothing to migrate."
  exit 0
fi

mkdir -p "$DIR"
mv "$TMP_FILE" "$DIR/migration.sql"
trap - EXIT

echo ""
echo "Created migration: $DIR/migration.sql"
echo "----------------------------------------"
cat "$DIR/migration.sql"
echo "----------------------------------------"
echo ""
echo "Next steps:"
echo "  1. Review the SQL above (add any data backfill by hand)."
echo "  2. Apply it:    npm run db:migrate:deploy"
echo "  3. Regenerate:  npm run prisma:generate"
