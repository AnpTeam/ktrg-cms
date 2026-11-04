#!/bin/bash
# Points every uploaded-file address in the content at this server's /files. Run as root in /opt/ktrg:
#
#   ./move-files.sh https://example.com/files [https://old.example.com/files ...]
#
# 1. Copies every file the content links to on Cloudflare R2 (https://pub-....r2.dev/photos|videos/...) into the uploads
#    volume, with a video's subtitles (.vtt) when there are any, and points each copied file's address here. R2 is only
#    read; a file that cannot be copied keeps its R2 address.
# 2. Replaces any older addresses of this server given after the new one (for example the test address before the real
#    domain) by the new one.
# Every text, varchar, json and jsonb column of the app's tables is searched. Run it after each copy of the data from
# Supabase (supabase-to-s3.sh + restore-from-s3.sh), and once when the domain changes. Safe to run again.
# It makes a database backup first (backup-db.sh), so restore-from-s3.sh can undo it.
set -euo pipefail
cd /opt/ktrg
./backup-db.sh
NEW="${1:?usage: move-files.sh <new base, e.g. https://example.com/files> [old base ...]}"
NEW="${NEW%/}"
shift
UPLOADS="$(docker volume inspect ktrg_storage_data --format '{{ .Mountpoint }}')"
run_sql() { docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -q'; }

# The R2 addresses the content uses, from a data-only dump. An address ends at whitespace (the dump separates columns
# with tabs), a quote, a comma, a bracket or a backslash.
R2_PATTERN='https://pub-[a-z0-9]+\.r2\.dev/(photos|videos)/[^][:space:]"'\''(),<>\\[]+'
mapfile -t R2_URLS < <(docker compose exec -T db sh -c 'pg_dump --data-only -U "$POSTGRES_USER" "$POSTGRES_DB"' </dev/null |
  grep -oE "$R2_PATTERN" | sort -u)
echo "R2 files linked from the content: ${#R2_URLS[@]}"

PAIRS=() # "old|new" address pairs to replace
for url in "${R2_URLS[@]}"; do
  base="${url%%/photos/*}"; base="${base%%/videos/*}"
  encoded="${url#"$base"/}"
  key="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(sys.argv[1]))' "$encoded")"
  if [[ ! "$key" =~ ^(photos|videos)/[^/]+$ ]] || [[ "$key" == *..* ]]; then
    echo "  skipped (odd address): $url"
    continue
  fi
  mkdir -p "$UPLOADS/$(dirname "$key")"
  if [ ! -s "$UPLOADS/$key" ]; then
    if curl -fsS --retry 3 -o "$UPLOADS/$key.part" "$url"; then
      mv "$UPLOADS/$key.part" "$UPLOADS/$key"
      echo "  copied $key"
    else
      rm -f "$UPLOADS/$key.part"
    fi
  fi
  # A video's subtitles sit beside it with .vtt in place of the extension.
  if [[ "$key" =~ ^videos/.*\.(mp4|webm)$ ]]; then
    vtt="${key%.*}.vtt"
    if [ ! -s "$UPLOADS/$vtt" ] && curl -fsS -o "$UPLOADS/$vtt.part" "${url%.*}.vtt" 2>/dev/null; then
      mv "$UPLOADS/$vtt.part" "$UPLOADS/$vtt"
      echo "  copied $vtt"
    fi
    rm -f "$UPLOADS/$vtt.part"
  fi
  if [ -s "$UPLOADS/$key" ]; then
    PAIRS+=("$url|$NEW/$encoded")
  else
    echo "  NOT copied, still points at R2: $url"
  fi
done
chown -R 1000:1000 "$UPLOADS" # the api runs as uid 1000 and must be able to replace subtitles

for old in "$@"; do
  old="${old%/}"
  [ "$old" = "$NEW" ] || PAIRS+=("$old/|$NEW/")
done

for pair in "${PAIRS[@]}"; do
  old="${pair%%|*}"
  new="${pair#*|}"
  echo "replacing $old -> $new"
  # Passed as psql variables, so the addresses are quoted by psql and never pasted into SQL.
  { echo "\\set old '${old//\'/\'\'}'"; echo "\\set new '${new//\'/\'\'}'"; cat <<'SQL'
SELECT set_config('move.old', :'old', false), set_config('move.new', :'new', false) \g /dev/null
DO $$
DECLARE r record; n bigint; total bigint := 0; o text := current_setting('move.old'); w text := current_setting('move.new');
BEGIN
  FOR r IN SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c
           JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
           WHERE c.table_schema = 'public' AND c.data_type IN ('text', 'character varying', 'json', 'jsonb') LOOP
    IF r.data_type IN ('json', 'jsonb') THEN
      EXECUTE format('UPDATE public.%I SET %I = replace(%I::text, $1, $2)::%s WHERE strpos(%I::text, $1) > 0',
        r.table_name, r.column_name, r.column_name, r.data_type, r.column_name) USING o, w;
    ELSE
      EXECUTE format('UPDATE public.%I SET %I = replace(%I, $1, $2) WHERE strpos(%I, $1) > 0',
        r.table_name, r.column_name, r.column_name, r.column_name) USING o, w;
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '  %.%: % rows', r.table_name, r.column_name, n; END IF;
    total := total + n;
  END LOOP;
  RAISE NOTICE '  % rows changed', total;
END
$$;
SQL
  } | run_sql
done
echo "move-files: done"
