#!/bin/sh
# Runs inside the nginx container at every start, after nginx's own step that turns templates/ into conf.d/.
# At the very first start there is no certificate yet, and nginx would refuse a config that points at one. So the
# HTTPS server is left out until Certbot has the certificate; port 80 alone is enough for Let's Encrypt's check.
rm -f /etc/nginx/conf.d/default.conf # nginx's own example site
if [ ! -f /etc/letsencrypt/live/ktrg/fullchain.pem ]; then
  echo "ktrg: no certificate yet, HTTP only until Certbot gets one"
  rm -f /etc/nginx/conf.d/20-https.conf
fi
