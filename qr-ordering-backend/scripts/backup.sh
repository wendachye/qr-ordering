#!/usr/bin/env bash
# Logical Postgres backup: pg_dump -> timestamped gzip.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/backup.sh [output_dir]
#
# Schedule via cron / Cloud Scheduler and ship the output to object storage.
# Primary backups should still be the managed provider's automated snapshots;
# this is a portable, restore-tested logical copy on top of that.
set -euo pipefail

DB_URL="${DATABASE_URL:?DATABASE_URL is required}"
OUT_DIR="${1:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/qr-ordering-$STAMP.sql.gz"

echo "[backup] dumping database to $FILE"
# Dump to a temp file and rename only on success, so a failed dump never leaves
# a truncated file that a later restore could pick up.
trap 'rm -f "$FILE.tmp"' EXIT
pg_dump --no-owner --no-privileges "$DB_URL" | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
trap - EXIT
echo "[backup] done ($(du -h "$FILE" | cut -f1))"

# Retention: drop local dumps older than RETENTION_DAYS (object-storage lifecycle
# rules should enforce retention on the shipped copies).
find "$OUT_DIR" -name 'qr-ordering-*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true

# Restore (into a scratch DB — verify periodically):
#   gunzip -c "$FILE" | psql -v ON_ERROR_STOP=1 --single-transaction "$DATABASE_URL"
