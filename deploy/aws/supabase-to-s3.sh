#!/bin/bash
# Copies the live database from Supabase into S3, as a dump restore-from-s3.sh can load:
#   s3://ktrg-backups-712723095627/db/ktrg-<time>-supabase.sql.gz
# Supabase is only READ (pg_dump); nothing there changes. Run ON THE SERVER as root, in /opt/ktrg:
#
#   ./supabase-to-s3.sh
#   ./restore-from-s3.sh          # then load it: it is the newest dump
#
# Needs SUPABASE_DATABASE_URL in the settings (/ktrg/env). Only the app's own schemas are copied: public (the tables)
# and drizzle (which migrations ran). Supabase's own schemas (auth, storage, ...) and its roles are left out.
set -euo pipefail
cd /opt/ktrg
BUCKET=ktrg-backups-712723095627
# "-supabase" after the time: the name still sorts by date, so restore-from-s3.sh picks the newest.
KEY="db/ktrg-$(date -u +%Y%m%dT%H%M%SZ)-supabase.sql.gz"
SRC="$(grep -E '^SUPABASE_DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')"
[ -n "$SRC" ] || { echo "SUPABASE_DATABASE_URL is not set in .env"; exit 1; }

# pg_dump runs in the db container (PostgreSQL 18 tools read older servers too); "$1" keeps the URL out of the log.
#   -n public -n drizzle      the app's schemas only
#   --no-owner --no-privileges  leave out Supabase's users and grants (they do not exist here)
# The dump starts by dropping both schemas, so loading it REPLACES the app's tables, like our own backups. pg_dump's
# own "CREATE SCHEMA public" is removed, since the line before already made it.
echo "== reading Supabase"
{
  echo 'DROP SCHEMA IF EXISTS drizzle CASCADE;'
  echo 'DROP SCHEMA IF EXISTS public CASCADE;'
  echo 'CREATE SCHEMA public;'
  docker compose exec -T db sh -c 'pg_dump "$1" -n public -n drizzle --no-owner --no-privileges' _ "$SRC" </dev/null |
    sed '/^CREATE SCHEMA public;$/d'
} | gzip | aws s3 cp - "s3://$BUCKET/$KEY" --only-show-errors
echo "dump: s3://$BUCKET/$KEY ($(aws s3 ls "s3://$BUCKET/$KEY" | awk '{print $3}') bytes)"

# Rows per table in Supabase, to compare after the restore (./count-rows.sh prints the same for this server).
echo "== rows in Supabase"
bash ./count-rows.sh supabase
