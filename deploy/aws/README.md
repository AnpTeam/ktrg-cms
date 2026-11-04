# Running on AWS (EC2 + Docker)

One EC2 instance in Osaka runs the whole site with Docker Compose. Plan: 葛城修験観光アプリ_設計書 (AWS デプロイメント手順書).

```
visitor ─https─> nginx ─/api/*───> api:3001 (ktrg-cms) ──> db:5432 (ktrg-db, PostgreSQL 18)
                       ├─/files/*─> storage_data volume (uploaded photos and videos)
                       └─other────> web:3000 (ktrg-web, Next.js) ──> api:3001
```

| Thing | Value |
| --- | --- |
| Server | `ktrg-cms`, t4g.small (ARM64), Amazon Linux 2023, 30 GB gp3, no key pair; files in `/opt/ktrg` |
| Address | Elastic IP `15.168.187.126`, site https://15-168-187-126.sslip.io |
| Firewall | Security group `ktrg-web`: 80 and 443 only. No SSH: Session Manager |
| Server role | `EC2-ECR-ReadOnly-Role`: ECR read, Session Manager, inline `ktrg-server` (backup bucket, `/ktrg/*` settings, metrics) |
| Images | ECR `ktrg-cms` (API), `ktrg-web` (website), `ktrg-db` (postgres:18-alpine); newest 20 kept |
| Settings | SSM Parameter Store `/ktrg/env` (SecureString), written to `/opt/ktrg/.env` by `deploy.sh` |
| Backups | `s3://ktrg-backups-712723095627/db/` (daily 03:00 JST, 90 days) and `/backups/images/` (daily, never deleted) |
| HTTPS | Let's Encrypt via Certbot, renewed by a timer |
| Alarms | CloudWatch `ktrg-*` (CPU, memory, disk > 80%; hardware auto-recover) → SNS `ktrg-alerts` → email |

Containers: `nginx-gateway`, `ktrg-web`, `ktrg-api`, `ktrg-migrate` (runs the migrations at each start, then stops),
`ktrg-db`, `ktrg-pgadmin`, `s3_backup_cron`. Only nginx is reachable from the internet; pgAdmin listens on the
server's 127.0.0.1 only.

## Files here

| File | Where it runs | What it does |
| --- | --- | --- |
| `aws-setup.sh [1-5]` | your PC | AWS: IAM role, security group, ECR, EC2 + Elastic IP, S3 |
| `cicd-setup.sh` | your PC | GitHub sign-in (OIDC) and the role `ktrg-github-deploy` |
| `alarms-setup.sh [email]` | your PC | CloudWatch alarms and the alert email |
| `server-setup.sh` | server | Swap, Docker, Compose, CloudWatch agent |
| `timers-setup.sh` | server | The scheduled jobs (below) |
| `docker-compose.yml`, `nginx/` | server | The services and the nginx config |
| `deploy.sh [tag]` | server | Settings → images → start → certificate → health check |
| `backup-db.sh` | server | Database dump to S3 |
| `restore-from-s3.sh [--with-files] [dump]` | server | Database back from S3 (and the files, with `--with-files`) |
| `supabase-to-s3.sh` | server | Live database from Supabase to S3 (Supabase is only read) |
| `move-files.sh <base> [old base...]` | server | Files from R2 to the server, addresses rewritten |
| `count-rows.sh [supabase]` | server | Rows per table, to compare copies |
| `renew-cert.sh`, `purge-deletions.sh` | server | Run by the timers |

**Your PC** means Git Bash in the project folder, with `AWS_PROFILE=ktrg`, `AWS_REGION=ap-northeast-3` and
`MSYS_NO_PATHCONV=1` set (without the last one Git Bash turns `/ktrg/env` into a Windows path). **Server** means a
Session Manager shell, then `sudo -i; cd /opt/ktrg`.

## Getting a shell on the server

AWS console → EC2 → `ktrg-cms` → Connect → Session Manager, or from your PC:

```bash
aws ssm start-session --target <instance id>
```

## Deploying a new version

**Automatically** (once `deploy-aws.yml` is on main and `cicd-setup.sh` has run): merge to main. When CI passes,
GitHub builds the images on ARM, pushes them to ECR (tag = the commit), uploads this folder to S3 and runs
`deploy.sh <commit>` on the server.

**By hand**: get the files onto the server, then deploy a tag that is in ECR:

```bash
# your PC
aws s3 sync deploy/aws s3://ktrg-backups-712723095627/deploy/aws/ --exclude ".env*" --delete
# server
aws s3 sync s3://ktrg-backups-712723095627/deploy/aws/ /opt/ktrg/ && chmod +x /opt/ktrg/*.sh
./deploy.sh <tag>
```

Roll back: `./deploy.sh <older tag>`. Migrations only ever add, so an older API still works on a newer database.

## Changing a setting

Edit `deploy/aws/.env.production` (ignored by git; save it with LF line endings), upload it, then deploy without a
tag (same version, new settings):

```bash
aws ssm put-parameter --name /ktrg/env --type SecureString --overwrite --value file://deploy/aws/.env.production
# server
./deploy.sh
```

Leave an unused setting out entirely rather than writing `NAME=` with nothing after it: the API refuses some empty
values and will not start. Never paste the file's contents anywhere; it holds the passwords.

## Scheduled jobs

`systemctl list-timers 'ktrg-*'` shows them (times in UTC). Logs: `journalctl -u ktrg-backup`. Run one now:
`systemctl start ktrg-backup`.

| Timer | When | Runs |
| --- | --- | --- |
| `ktrg-backup` | daily 03:00 JST | `backup-db.sh` |
| `ktrg-certbot` | 00:00 and 12:00 | `renew-cert.sh` (renews 30 days before expiry) |
| `ktrg-purge` | hourly | `purge-deletions.sh` (accounts whose deletion is due) |

The uploaded files are copied to S3 by the `s3_backup_cron` container once a day (`docker logs s3_backup_cron`).

## Backups and restore

```bash
aws s3 ls s3://ktrg-backups-712723095627/db/
./backup-db.sh                                   # a dump now (do this before changing data by hand)
./restore-from-s3.sh                             # the newest dump
./restore-from-s3.sh ktrg-<time>.sql.gz          # a chosen one
./restore-from-s3.sh --with-files <dump>         # also the files: only for a lost disk
```

A restore replaces the app's tables. `restore-from-s3.sh` takes the newest dump by name, so check which one it says
before it runs.

## Moving the data from Supabase

```bash
./supabase-to-s3.sh                                         # prints Supabase's row counts
./restore-from-s3.sh ktrg-<time>-supabase.sql.gz
./count-rows.sh                                             # must match
./move-files.sh https://<domain>/files [https://<old domain>/files]
docker restart s3_backup_cron                               # back up the new files now
```

`move-files.sh` reads R2 and never changes it; a file it cannot fetch keeps its R2 address. Run it again after the
domain changes, with the new address first and the old ones after.

## pgAdmin

Open a tunnel from your PC, leave it running, then browse http://localhost:5050:

```bash
aws ssm start-session --target <instance id> --document-name AWS-StartPortForwardingSession \
  --parameters 'portNumber=5050,localPortNumber=5050'
```

Log in with `PGADMIN_EMAIL` / `PGADMIN_PASSWORD`. Register the database once: host `db` (the container's name, not
localhost), port 5432, and `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD`. It is the live database: run
`./backup-db.sh` before editing data.

## Setting up from nothing

1. Your PC: `bash deploy/aws/aws-setup.sh` (one step at a time: `... aws-setup.sh 1`, `2`, ...).
2. Your PC: `.env.production` → Parameter Store (above).
3. Server: `server-setup.sh` (get it with `aws s3 cp s3://ktrg-backups-712723095627/deploy/aws/server-setup.sh .`).
4. Images in ECR: the GitHub workflow, or build on the server. For the latter, give the server role push rights
   for a moment (an inline policy with `ecr:InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`,
   `PutImage` on the three repositories), copy the code there (`git archive --format=tar.gz HEAD` → S3), then
   `docker build -f apps/api/Dockerfile -t <registry>/ktrg-cms:<tag> .` (and `apps/web/Dockerfile` → `ktrg-web`),
   `docker tag postgres:18-alpine <registry>/ktrg-db:18-alpine`, `docker push` all three, and remove the policy.
5. Server: `./deploy.sh <tag>`; it gets the HTTPS certificate the first time (the Elastic IP must point here).
6. Server: `./restore-from-s3.sh`, then `bash timers-setup.sh`.
7. Your PC: `bash deploy/aws/alarms-setup.sh <email>`, and click the link in the confirmation email.
