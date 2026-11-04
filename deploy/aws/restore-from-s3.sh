#!/bin/bash
# Puts back the DATABASE from an S3 dump (a new server, or undoing a mistake). Uploaded files are left alone.
# Run ON THE SERVER as root, in /opt/ktrg, with everything running (docker compose up -d):
#
#   ./restore-from-s3.sh                                        # the newest dump
#   ./restore-from-s3.sh ktrg-20261104T081225Z-supabase.sql.gz  # a chosen one (aws s3 ls s3://ktrg-backups-712723095627/db/)
#   ./restore-from-s3.sh --with-files [dump]                    # also the uploaded files, from S3 backups/images/
#
# The dump REPLACES the app's tables (made with --clean). --with-files is for a lost disk: it copies the files back
# (none are deleted). Otherwise the files stay as they are on the server (and come from R2 via move-files.sh).
set -euo pipefail
cd /opt/ktrg
BUCKET=ktrg-backups-712723095627

WITH_FILES=no
if [ "${1:-}" = --with-files ]; then WITH_FILES=yes; shift; fi

# Which dump: the one given, or the newest (the names contain the date, so the last after sorting).
DUMP="${1:-$(aws s3 ls "s3://$BUCKET/db/" | awk '{print $4}' | sort | tail -n 1)}"
[ -n "$DUMP" ] || { echo "no dump in s3://$BUCKET/db/"; exit 1; }
echo "== database: s3://$BUCKET/db/$DUMP"

# Nobody writes to the database while it is replaced.
docker compose stop api web

# Download, unzip and feed it to psql in one stream (no file on disk). -T: input is a pipe, not a keyboard.
# ON_ERROR_STOP=1: stop at the first error instead of carrying on half-done.
aws s3 cp "s3://$BUCKET/db/$DUMP" - --only-show-errors | gunzip |
  docker compose exec -T db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' >/dev/null
echo "database restored"

if [ "$WITH_FILES" = yes ]; then
  echo "== uploaded files: s3://$BUCKET/backups/images/"
  UPLOADS="$(docker volume inspect ktrg_storage_data --format '{{ .Mountpoint }}')"
  aws s3 sync "s3://$BUCKET/backups/images/" "$UPLOADS" --only-show-errors
  chown -R 1000:1000 "$UPLOADS" # the API's user (bun) must own them, to replace or delete them
  echo "files: $(find "$UPLOADS" -type f | wc -l), $(du -sh "$UPLOADS" | cut -f1)"
fi

# Start api and web again. migrate runs once more first: it adds any table newer than the dump.
docker compose up -d
docker compose logs migrate --tail 3
docker compose ps
