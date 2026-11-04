#!/bin/bash
# Installs the server's scheduled jobs as systemd timers (systemd's cron; Amazon Linux 2023 has no cron).
# Run ON THE SERVER as root, once (again after changing a schedule):  bash timers-setup.sh
#
#   timer          when                       runs
#   ktrg-backup    every day 03:00 JST        backup-db.sh        database dump to S3
#   ktrg-certbot   every day 00:00 and 12:00  renew-cert.sh       HTTPS certificate (renewed 30 days before expiry)
#   ktrg-purge     every hour                 purge-deletions.sh  erase accounts whose deletion is due
#
# See them:  systemctl list-timers 'ktrg-*'      Logs:  journalctl -u ktrg-backup     Run now:  systemctl start ktrg-backup
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root: sudo -i first"; exit 1; }

# Each job is two small files: a .service (what to run) and a .timer (when).
#   timer <name> <when (OnCalendar)> <script> <description>
timer() {
  cat > "/etc/systemd/system/$1.service" <<UNIT
[Unit]
Description=$4
After=docker.service
[Service]
Type=oneshot
WorkingDirectory=/opt/ktrg
ExecStart=/opt/ktrg/$3
UNIT
  cat > "/etc/systemd/system/$1.timer" <<UNIT
[Unit]
Description=$4 (schedule)
[Timer]
OnCalendar=$2
# Persistent: a run missed while the server was off happens right after it starts again.
Persistent=true
# A few minutes of random delay, so the jobs never all start at the same second.
RandomizedDelaySec=300
[Install]
WantedBy=timers.target
UNIT
}

timer ktrg-backup  "*-*-* 03:00:00 Asia/Tokyo" backup-db.sh       "Back up the ktrg database to S3"
timer ktrg-certbot "*-*-* 00,12:00:00"         renew-cert.sh      "Renew the ktrg HTTPS certificate"
timer ktrg-purge   "hourly"                    purge-deletions.sh "Erase ktrg accounts whose deletion is due"

chmod +x /opt/ktrg/*.sh
systemctl daemon-reload
systemctl enable --now ktrg-backup.timer ktrg-certbot.timer ktrg-purge.timer
systemctl list-timers 'ktrg-*'
