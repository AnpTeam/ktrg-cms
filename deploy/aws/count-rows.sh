#!/bin/bash
# Exact number of rows in each of the app's tables (schema public). Run ON THE SERVER as root, in /opt/ktrg:
#
#   ./count-rows.sh             # this server's database
#   ./count-rows.sh supabase    # Supabase (only read), to compare after a copy
set -euo pipefail
cd /opt/ktrg

# One query that counts every table: built from the list of tables, then run (\gset stores it in :q).
SQL="select string_agg(format('select %L as t, count(*) as n from public.%I', table_name, table_name), ' union all '
       order by table_name) as q
     from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' \\gset
:q order by t;"

if [ "${1:-}" = supabase ]; then
  SRC="$(grep -E '^SUPABASE_DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')"
  [ -n "$SRC" ] || { echo "SUPABASE_DATABASE_URL is not set in .env"; exit 1; }
  echo "$SQL" | docker compose exec -T db sh -c 'psql "$1" -At -F " "' _ "$SRC"
else
  echo "$SQL" | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -At -F " "'
fi | awk '{ printf "%-40s %8s\n", $1, $2; total += $2 } END { printf "%-40s %8s\n", "TOTAL", total }'
