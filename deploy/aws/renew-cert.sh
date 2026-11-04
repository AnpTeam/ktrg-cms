#!/bin/bash
# Renews the HTTPS certificate when it is due, then reloads nginx so it uses the new one.
# Run by the ktrg-certbot timer twice a day (timers-setup.sh). By hand, as root in /opt/ktrg: ./renew-cert.sh
#
# certbot renew does nothing until fewer than 30 days are left (the certificate lasts 90), so running it often is
# harmless; twice a day is what Let's Encrypt recommends.
set -euo pipefail
cd /opt/ktrg
[ -f certbot/conf/live/ktrg/fullchain.pem ] || { echo "no certificate yet"; exit 0; }
docker compose run --rm certbot renew --webroot -w /var/www/certbot --quiet </dev/null
# reload: nginx re-reads the certificate without dropping any connection (restart would)
docker compose exec -T nginx nginx -s reload </dev/null
echo "renew-cert: checked, $(openssl x509 -in certbot/conf/live/ktrg/fullchain.pem -noout -enddate)"
