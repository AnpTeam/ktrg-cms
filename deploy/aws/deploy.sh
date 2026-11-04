#!/bin/bash
# Deploys a version: settings → images → start → certificate → check. Run ON THE SERVER as root, in /opt/ktrg:
#
#   ./deploy.sh 20261104-0743     # this image version (the tag in ECR)
#   ./deploy.sh                   # the version deployed last: use it after changing a setting in Parameter Store
#
# Get the newest compose file, nginx config and scripts first (the GitHub workflow does this for you):
#   aws s3 sync s3://ktrg-backups-712723095627/deploy/aws/ /opt/ktrg/
#
# Roll back = deploy an older tag. Migrations only ever add, so an older API still works on a newer database.
set -euo pipefail
cd /opt/ktrg
REGION=ap-northeast-3
chmod +x ./*.sh nginx/*.sh

# ---- 1. Which version ---------------------------------------------------------------------------------------------
# The tag given, else the one in .tag (written by the last deploy), else latest.
TAG="${1:-$(cat .tag 2>/dev/null || echo latest)}"
echo "== deploying $TAG"

# ---- 2. Settings: Parameter Store /ktrg/env → .env -----------------------------------------------------------------
# umask 077: the new .env is readable by root only (it holds the passwords). Any TAG= line in the settings is
# dropped so the version always comes from here.
umask 077
{
  aws ssm get-parameter --region $REGION --name /ktrg/env --with-decryption --query Parameter.Value --output text |
    grep -v '^TAG='
  echo "TAG=$TAG"
} > .env.new
mv .env.new .env
umask 022
echo "$TAG" > .tag
setting() { grep -m1 "^$1=" .env | cut -d= -f2-; }
REGISTRY="$(setting REGISTRY)"
DOMAIN="$(setting DOMAIN)"

# ---- 3. Images ----------------------------------------------------------------------------------------------------
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
docker compose pull --quiet

# ---- 4. Start -----------------------------------------------------------------------------------------------------
# Only containers whose image or settings changed are replaced; migrate runs first and the api waits for it.
mkdir -p certbot/conf certbot/www
docker compose up -d --remove-orphans

# ---- 5. HTTPS certificate -----------------------------------------------------------------------------------------
# Get one when there is none yet, or when it does not cover DOMAIN (the domain changed). Renewal is the timer's job.
CERT=certbot/conf/live/ktrg/fullchain.pem
if ! { [ -f "$CERT" ] && openssl x509 -in "$CERT" -noout -ext subjectAltName | grep -qF "DNS:$DOMAIN"; }; then
  echo "== getting a certificate for $DOMAIN"
  docker compose run --rm certbot certonly --webroot -w /var/www/certbot --cert-name ktrg -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email </dev/null
  docker compose restart nginx
fi

# ---- 6. Check -----------------------------------------------------------------------------------------------------
# Through nginx and HTTPS, as a visitor would (--resolve: ask this server, not DNS). The api needs a few seconds.
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/v1/health" || true)"
  [ "$code" = 200 ] && break
  sleep 2
done
docker image prune -f >/dev/null # old images no container uses any more
docker compose ps
if [ "$code" = 200 ]; then
  echo "== deployed $TAG: https://$DOMAIN is up"
else
  echo "== deployed $TAG, but https://$DOMAIN/api/v1/health answers $code. Look at: docker compose logs api --tail 50"
  exit 1
fi
