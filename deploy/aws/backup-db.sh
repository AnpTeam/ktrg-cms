#!/bin/bash
# Makes a dump (.sql.gz) of the database and saves it in S3: s3://ktrg-backups-712723095627/db/ (kept 90 days).
# Run ON THE SERVER as root, in /opt/ktrg:
#
#   ./backup-db.sh
#
# Later a daily timer runs it (03:00 JST). The uploaded files are backed up by the s3_backup_cron container.
# Uses the server's IAM role: no AWS keys. Restore: restore-from-s3.sh.
set -euo pipefail
cd /opt/ktrg
BUCKET=ktrg-backups-712723095627
KEY="db/ktrg-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"   # the time in the name (UTC), so names sort by date

# pg_dump runs inside the db container and streams the SQL out; gzip packs it; aws s3 cp uploads it.
#   --clean --if-exists  the dump first drops each table, so a restore replaces what is there
#   --no-owner           no "ALTER ... OWNER" lines: restorable under any database user
docker compose exec -T db sh -c 'pg_dump --clean --if-exists --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' </dev/null \
  | gzip | aws s3 cp - "s3://$BUCKET/$KEY" --only-show-errors

echo "backup: s3://$BUCKET/$KEY ($(aws s3 ls "s3://$BUCKET/$KEY" | awk '{print $3}') bytes)"
