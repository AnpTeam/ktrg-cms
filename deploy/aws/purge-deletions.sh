#!/bin/bash
# Erases the accounts whose deletion was asked for 3 days ago (POST /api/v1/internal/purge-deletions).
# Run by the ktrg-purge timer every hour (timers-setup.sh). By hand, as root in /opt/ktrg: ./purge-deletions.sh
#
# The call is made from inside the api container, so it never leaves the server. The API answers only with the
# secret CRON_SECRET (from the settings); without it the route does not exist, and this does nothing.
set -euo pipefail
cd /opt/ktrg
docker compose exec -T api bun -e '
const secret = process.env.CRON_SECRET;
if (!secret) { console.log("purge: CRON_SECRET not set, skipped"); process.exit(0); }
const res = await fetch("http://localhost:3001/api/v1/internal/purge-deletions",
  { method: "POST", headers: { authorization: `Bearer ${secret}` } });
console.log(`purge: HTTP ${res.status} ${await res.text()}`);
process.exit(res.ok ? 0 : 1);
' </dev/null
