# AWS setup guide: step by step

How the ktrg site was moved onto one EC2 server, in the order it was done, with what each command does and why.
Plan: 葛城修験観光アプリ_設計書 (AWS デプロイメント手順書). Day-to-day operation (deploying, settings, backups) is in
[deploy/aws/README.md](../deploy/aws/README.md); this guide is for learning how the pieces fit, or for doing it all again.

```
visitor ─https─> nginx ─/api/*───> api:3001 ──> db:5432 (PostgreSQL 18)
                       ├─/files/*─> storage_data volume (photos, videos)
                       └─other────> web:3000 (Next.js) ──> api:3001
```

| Part | Steps |
| --- | --- |
| A. Your PC and AWS | 0 terminal · 1 IAM role · 2 security group · 3 ECR · 4 EC2 + Elastic IP · 5 S3 |
| B. The server | 6 Session Manager · 7 host setup |
| C. The app | 8 code · 9 compose + nginx · 10 settings · 11 images · 12 start · 13 HTTPS |
| D. The data | 14 Supabase → S3 → server · 15 files from R2 |
| E. Running it | 16 timers · 17 deploy.sh · 18 pgAdmin · 19 alarms · 20 CI/CD · 21 clean-up |
| | [Lessons learned](#lessons-learned) |

---

## A. Your PC and AWS

### Step 0: the terminal

Use **Git Bash** in VS Code (Terminal → New Terminal → ▾ → Git Bash), in the project folder:

```bash
cd ~/Desktop/work/ktrg-cms
export AWS_PROFILE=ktrg            # every aws command logs in as the IAM user ktrg-admin
export AWS_REGION=ap-northeast-3   # Osaka
export MSYS_NO_PATHCONV=1          # stop Git Bash turning /ktrg/env into C:/Program Files/Git/ktrg/env
aws sts get-caller-identity        # "who am I?": must show user/ktrg-admin in account 712723095627
```

The `export` lines last only for that terminal. To set them in every new one, add them to `~/.bashrc` once:

```bash
cat >> ~/.bashrc <<'EOF'
export AWS_PROFILE=ktrg
export AWS_REGION=ap-northeast-3
export MSYS_NO_PATHCONV=1
EOF
```

Steps 1–5 are in one script you run one step at a time: `bash deploy/aws/aws-setup.sh <n>`. Each step checks what
already exists first, so running it again is safe.

### Step 1: IAM role for the server

A **role** is the permissions the server itself uses. Nothing like a key is stored on the server; AWS hands it
short-lived permissions.

```bash
bash deploy/aws/aws-setup.sh 1
```

Role `EC2-ECR-ReadOnly-Role` (made in the console) gets:

| Policy | Kind | Lets the server |
| --- | --- | --- |
| `AmazonEC2ContainerRegistryReadOnly` | attached (made by AWS) | download images from ECR |
| `AmazonSSMManagedInstanceCore` | attached (made by AWS) | be reached by Session Manager (no SSH needed) |
| `ktrg-server` | inline (ours) | use the backup bucket, read the `/ktrg/*` settings, send memory/disk metrics |

Without `AmazonSSMManagedInstanceCore` the server never shows up in Session Manager: the console's role wizard makes
it easy to leave out.

### Step 2: security group (firewall)

```bash
bash deploy/aws/aws-setup.sh 2
```

Group `ktrg-web`: **80** (Let's Encrypt's check, redirect) and **443** (the site) open to `0.0.0.0/0` (everyone);
everything else closed, including 22 (SSH), 3000, 3001 and 5432. Expected: `tcp 80 0.0.0.0/0` and `tcp 443 0.0.0.0/0`.

### Step 3: ECR repositories

ECR stores Docker images: the build **pushes** to it, the server **pulls** from it.

```bash
bash deploy/aws/aws-setup.sh 3
```

`ktrg-cms` (API), `ktrg-web` (website), `ktrg-db` (PostgreSQL), each with scan on push and a rule keeping the newest
20 images. An image's full name is `712723095627.dkr.ecr.ap-northeast-3.amazonaws.com/ktrg-web:<tag>`
(account . ECR . region / repository : version).

To empty a repository: `aws ecr delete-repository --repository-name <repo> --force`, then step 3 again.

### Step 4: EC2 instance and Elastic IP

```bash
bash deploy/aws/aws-setup.sh 4
```

| Setting | Value | Why |
| --- | --- | --- |
| type | t4g.small | 2 vCPU, 2 GB, ARM (Graviton); free-tier eligible, paid from the credits |
| image | Amazon Linux 2023 ARM64 | the newest, looked up from AWS's public parameter |
| role / firewall | step 1 / step 2 | |
| disk | 30 GB gp3, encrypted | encryption costs nothing |
| metadata | `HttpTokens=required`, hop limit 2 | the secure way to hand out the role; 2 lets containers use it too |
| key pair | none | Session Manager only |

Then the Elastic IP (the fixed address `15.168.187.126`) is moved onto it. Expected:
`i-… t4g.small running 15.168.187.126`.

### Step 5: S3 backup bucket

```bash
bash deploy/aws/aws-setup.sh 5
```

`ktrg-backups-712723095627`, public access blocked: `db/` (database dumps, deleted after 90 days),
`backups/images/` (uploaded files), `deploy/aws/` (the server's files). `PRE` in `aws s3 ls` means a folder.

---

## B. The server

### Step 6: reaching the server (Session Manager)

Wait about 2 minutes after launch, then check it is registered:

```bash
aws ssm describe-instance-information --query 'InstanceInformationList[].[InstanceId,PingStatus]' --output text
```

Open a shell: **EC2 console → Instances → `ktrg-cms` → Connect → Session Manager → Connect**, or from your PC:

```bash
aws ssm start-session --target <instance id>
```

Then `sudo -i` (become root). Leave with `exit` twice.

| Prompt | You are on |
| --- | --- |
| `user@KAN-hp-122 MINGW64 ~/Desktop/work/ktrg-cms` | your PC |
| `[root@ip-172-31-31-146 ktrg]#` | the server |

### Step 7: host setup

Files go from your PC to the server through S3 (the server's role can read the bucket):

```bash
# your PC
aws s3 sync deploy/aws s3://ktrg-backups-712723095627/deploy/aws/ --exclude ".env*" --delete
# server
mkdir -p /opt/ktrg && cd /opt/ktrg
aws s3 sync s3://ktrg-backups-712723095627/deploy/aws/ /opt/ktrg/ && chmod +x /opt/ktrg/*.sh
bash server-setup.sh
```

`--exclude ".env*"` keeps the settings file off S3. `chmod +x` is needed because S3 does not keep the "executable" mark.

`server-setup.sh` (設計書 7):

| Part | What |
| --- | --- |
| a | `dnf update` (Amazon Linux's package manager) |
| b | 2 GB swap file, `vm.swappiness=10` (use it only when memory is nearly full) |
| c | Docker, with log rotation (5 × 20 MB per container) so logs cannot fill the disk |
| d | Docker Compose plugin (ARM build, from GitHub: Amazon Linux has no package for it) |
| e | CloudWatch agent: sends memory and disk use every minute |
| f | check: `free -h` shows `Swap: 2.0Gi`, `docker run hello-world` prints `Hello from Docker!` |

Part c restarts Docker: if the site is already running, it is down for 10–20 seconds.

---

## C. The app

### Step 8: the code the server needs

Compared with a plain `main`, the server needs (all in `apps/`): Dockerfiles that install packages in the final image,
`apps/api/scripts/migrate.ts` (migrations run inside the API image, without drizzle-kit), uploads stored on disk
(`UPLOADS_DIR`, a signed address for videos up to 200 MB), and Cloudflare's visit-place headers. `.gitattributes`
keeps `.sh` and `deploy/aws/` files in Linux line endings (LF): a Windows line ending in a script fails on the server
with `$'\r': command not found`.

Check it still fits: `bun install --frozen-lockfile`, `bun run --cwd apps/api typecheck`, `bun run --cwd apps/api test`.

### Step 9: docker-compose.yml and nginx (設計書 5, 6)

[deploy/aws/docker-compose.yml](../deploy/aws/docker-compose.yml):

| Service | Container | Job |
| --- | --- | --- |
| nginx | `nginx-gateway` | the only one with ports (80, 443): HTTPS, routing, `/files/` |
| certbot | (one-off) | gets and renews the certificate, then exits |
| web | `ktrg-web` | Next.js, port 3000 inside the network only (`expose`) |
| api | `ktrg-api` | the API, 3001; writes uploads into `storage_data` |
| migrate | `ktrg-migrate` | updates the tables, then stops; the api waits for it |
| db | `ktrg-db` | PostgreSQL 18, data in `db_data` |
| pgadmin | `ktrg-pgadmin` | database GUI on 127.0.0.1:5050 only |
| backup_s3 | `s3_backup_cron` | copies `storage_data` to S3 every 24 h, with the server's role (no keys), never deletes |

`depends_on` with conditions sets the start order: db healthy → migrate finished → api → web → nginx.

[deploy/aws/nginx/](../deploy/aws/nginx/): the official nginx image turns `templates/*.template` into config at start,
filling in `${DOMAIN}`.

| File | Job |
| --- | --- |
| `00-common` | visitor IP behind Cloudflare, rate limit 10 requests/s (burst 20) on `/api/`, gzip |
| `10-http` | port 80: Let's Encrypt's check, everything else → HTTPS |
| `20-https` | port 443: TLS 1.2/1.3, `/api/`, 210 MB on the video address, `/files/`, the website |
| `snippets/security-headers.conf` | X-Frame-Options DENY, nosniff, Referrer-Policy, HSTS |
| `snippets/proxy.conf` | headers to the app |
| `40-ktrg-https.sh` | leaves HTTPS out while there is no certificate yet, so nginx can start |

Two corrections to the plan's nginx example:

- `proxy_pass http://api:3001` with **no `/` at the end**: with it, nginx cuts `/api` off every path and the API
  answers 404.
- `X-Forwarded-For $remote_addr`, not `$proxy_add_x_forwarded_for`: the latter keeps what the visitor sent, so a
  visitor could fake an address and get round the rate limit.

Check the compose file on your PC without Docker running: `docker compose config -q` (needs a `.env` with the
`${…:?}` settings, even dummy ones).

### Step 10: the settings (.env)

Settings live in **SSM Parameter Store** `/ktrg/env` (encrypted). `deploy/aws/.env.production` on your PC is the
source; it is ignored by git.

```
.env.production (your PC) ──put-parameter──> Parameter Store /ktrg/env ──get-parameter (role)──> /opt/ktrg/.env
```

In `.env.production`: `S3_BUCKET_NAME=ktrg-backups-712723095627`, `PGADMIN_EMAIL`, `PGADMIN_PASSWORD`
(`openssl rand -base64 24`); no `TAG=` line (the deploy sets it); no empty lines like `R2_ACCOUNT_ID=` (the API
refuses some empty values). Save it with **LF** line endings (VS Code, bottom right: CRLF → LF).

```bash
aws ssm put-parameter --name /ktrg/env --type SecureString --overwrite --value file://deploy/aws/.env.production
aws ssm get-parameter --name /ktrg/env --with-decryption --query Parameter.Value --output text | cut -d= -f1   # names only
```

Each upload is a new version; old ones stay in the history.

### Step 11: build the images

Built on the server itself: it is ARM like the images need to be, so no emulation (an Intel PC would need QEMU,
slow). Later GitHub Actions does this (step 20).

```bash
# your PC: commit, pack the committed code, upload it
git archive --format=tar.gz -o ktrg-src.tar.gz HEAD
aws s3 cp ktrg-src.tar.gz s3://ktrg-backups-712723095627/deploy/ktrg-src.tar.gz && rm ktrg-src.tar.gz
# your PC: let the server push to ECR, for now
cat > ecr-push.json <<'EOF'
{ "Version": "2012-10-17", "Statement": [ { "Effect": "Allow",
  "Action": ["ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage"],
  "Resource": ["arn:aws:ecr:ap-northeast-3:712723095627:repository/ktrg-cms",
               "arn:aws:ecr:ap-northeast-3:712723095627:repository/ktrg-web",
               "arn:aws:ecr:ap-northeast-3:712723095627:repository/ktrg-db"] } ] }
EOF
aws iam put-role-policy --role-name EC2-ECR-ReadOnly-Role --policy-name ecr-push-temp --policy-document file://ecr-push.json
rm ecr-push.json
```

```bash
# server
cd /opt/ktrg && rm -rf src && mkdir src
aws s3 cp s3://ktrg-backups-712723095627/deploy/ktrg-src.tar.gz - | tar -xz -C src && cd src
REGISTRY=712723095627.dkr.ecr.ap-northeast-3.amazonaws.com
TAG=$(date +%Y%m%d-%H%M)
aws ecr get-login-password --region ap-northeast-3 | docker login --username AWS --password-stdin $REGISTRY
docker build -f apps/api/Dockerfile -t $REGISTRY/ktrg-cms:$TAG -t $REGISTRY/ktrg-cms:latest .
docker build -f apps/web/Dockerfile -t $REGISTRY/ktrg-web:$TAG -t $REGISTRY/ktrg-web:latest .
docker pull postgres:18-alpine && docker tag postgres:18-alpine $REGISTRY/ktrg-db:18-alpine
docker push --all-tags $REGISTRY/ktrg-cms
docker push --all-tags $REGISTRY/ktrg-web
docker push $REGISTRY/ktrg-db:18-alpine
echo "TAG=$TAG"
```

The API builds in seconds, the website in about 2–3 minutes (Next.js). `Layer already exists` on the second tag is
normal: `latest` is the same image. Afterwards:

```bash
# your PC: back to read-only (if the server were broken into, nobody could replace your images)
aws iam delete-role-policy --role-name EC2-ECR-ReadOnly-Role --policy-name ecr-push-temp
# server: clean up the build
cd /opt/ktrg && rm -rf src && docker builder prune -af && docker image prune -af && df -h /
```

### Step 12: start everything

Done by hand the first time; later `deploy.sh` (step 17) does all of it.

```bash
# server
cd /opt/ktrg
aws s3 sync s3://ktrg-backups-712723095627/deploy/aws/ /opt/ktrg/ && chmod +x *.sh nginx/*.sh
aws ssm get-parameter --name /ktrg/env --with-decryption --query Parameter.Value --output text > .env
echo "TAG=<tag from step 11>" >> .env
chmod 600 .env                         # root only: it holds the passwords
mkdir -p certbot/conf certbot/www
REGISTRY=712723095627.dkr.ecr.ap-northeast-3.amazonaws.com
aws ecr get-login-password --region ap-northeast-3 | docker login --username AWS --password-stdin $REGISTRY
docker compose pull
docker compose up -d
docker compose ps
docker compose exec nginx nginx -t     # "syntax is ok", "test is successful"
```

`ktrg-migrate` shows `Exited`: correct, it ran and stopped. The api starts only when migrate succeeded.
At this point `http://<domain>/` answers `301` (redirect to HTTPS) and HTTPS is not on yet.

### Step 13: HTTPS certificate

Let's Encrypt certificates are free, last 90 days and are renewed for free.

```bash
# server
DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2)
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  --cert-name ktrg -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email
docker compose restart nginx           # needed: only now does nginx turn HTTPS on
docker compose exec nginx ls /etc/nginx/conf.d    # 00-common.conf 10-http.conf 20-https.conf
```

Let's Encrypt checks you own the domain by fetching a file Certbot puts under `/.well-known/acme-challenge/`
(port 80). `--cert-name ktrg` keeps the path `live/ktrg/` even when the domain changes. If HTTPS says
"Connection refused", nginx was not restarted after Certbot.

---

## D. The data

### Step 14: database from Supabase

```
Supabase ──pg_dump (read only)──> S3 db/ktrg-<time>-supabase.sql.gz ──restore──> the server's PostgreSQL
```

```bash
# server, one line at a time
./supabase-to-s3.sh                                     # prints Supabase's rows per table
./restore-from-s3.sh ktrg-<time>-supabase.sql.gz        # name it: the newest dump is not always this one
./count-rows.sh                                         # must match, table by table (TOTAL 1745)
```

Only the app's schemas (`public`, `drizzle`) are copied, not Supabase's own (`auth`, `storage`…). A restore replaces
the tables; the long `drop cascades to …` list is that happening. `restore-from-s3.sh` restores the database only;
`--with-files` also copies the files back from S3 (for a lost disk).

Other SQL files: upload to S3, then on the server
`aws s3 cp s3://…/file.sql - | docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'`
(or pgAdmin's Query Tool). Plain `INSERT`s fail the second time (`duplicate key`). Make a backup first:
`./backup-db.sh`.

### Step 15: files from Cloudflare R2

```bash
# server
./move-files.sh https://15-168-187-126.sslip.io/files
docker restart s3_backup_cron           # back up the new files now instead of in 24 h
```

It finds every R2 address in the content, downloads each file into `storage_data` (as `x.part`, renamed when
complete), and rewrites the address to `https://<domain>/files/…`. R2 is only read; a file it cannot fetch keeps its
R2 address (`NOT copied`). It makes a database backup first. With a real domain later, run it with the new address
first and the old one after.

---

## E. Running it

### Step 16: scheduled jobs

Amazon Linux 2023 has no cron; systemd timers do the same. Each job is a `.service` (what) and a `.timer` (when).

```bash
# server
bash timers-setup.sh
systemctl start ktrg-backup && journalctl -u ktrg-backup -n 5 --no-pager     # test one now
```

| Timer | When | Job |
| --- | --- | --- |
| `ktrg-backup` | daily 03:00 Asia/Tokyo | `backup-db.sh` |
| `ktrg-certbot` | 00:00 and 12:00 | `renew-cert.sh` (Certbot renews only within 30 days of expiry) |
| `ktrg-purge` | hourly | `purge-deletions.sh` (erase accounts whose deletion is due) |

`systemctl list-timers 'ktrg-*'` shows times in **UTC** (the server's clock): 18:03 UTC = 03:03 JST.
`Persistent=true` catches up a run missed while the server was off.

### Step 17: deploy.sh

Steps 10–13 in one command:

```bash
# server
aws s3 sync s3://ktrg-backups-712723095627/deploy/aws/ /opt/ktrg/ && chmod +x /opt/ktrg/*.sh
./deploy.sh <tag>     # a version in ECR
./deploy.sh           # the last version again: after changing a setting
```

Settings → `.env` (written to `.env.new` first, so a failure leaves the old one) → ECR login → `pull` → `up -d`
(only changed containers are replaced) → certificate if missing or the domain changed → health check through HTTPS
→ `== deployed <tag>: https://<domain> is up`. Roll back by deploying an older tag.

### Step 18: pgAdmin

pgAdmin listens on the server's 127.0.0.1 only. A Session Manager tunnel brings it to your PC:

```bash
# your PC (Git Bash: lines end with \ ; PowerShell: with `)
aws ssm start-session --target <instance id> \
  --document-name AWS-StartPortForwardingSession \
  --parameters 'portNumber=5050,localPortNumber=5050'
```

Leave it running and open http://localhost:5050. Log in with `PGADMIN_EMAIL` / `PGADMIN_PASSWORD`. Register →
Server: host **`db`** (inside Docker, `localhost` would be pgAdmin's own container), port 5432, and the `POSTGRES_*`
settings. The app's tables are in **your `POSTGRES_DB` → Schemas → public** (the `postgres` database is empty).
`Ctrl+C` closes the tunnel.

### Step 19: CloudWatch alarms

```bash
# your PC (after server-setup.sh has started the agent)
bash deploy/aws/alarms-setup.sh you@example.com
```

Then click **Confirm subscription** in the email from AWS: until then alerts go nowhere (`PendingConfirmation`).

| Alarm | Fires when |
| --- | --- |
| `ktrg-cpu-80`, `ktrg-memory-80` | above 80% for 2 × 5 minutes |
| `ktrg-disk-80` | above 80% for 5 minutes |
| `ktrg-status-recover` | AWS's hardware check fails: AWS moves the server to healthy hardware by itself |

An OK email follows when the value is back below 80%.

### Step 20: CI/CD (ready, starts working on main)

```
merge to main → CI passes → build ARM images → push to ECR → upload deploy/aws to S3 → server runs deploy.sh <commit>
```

[.github/workflows/deploy-aws.yml](../.github/workflows/deploy-aws.yml) signs in to AWS with **OIDC**: AWS gives each
run short-lived permissions, so no AWS key is stored in GitHub, and only workflows on main may use the role. When
merging:

1. Your PC: `bash deploy/aws/cicd-setup.sh` (the OIDC provider and the role `ktrg-github-deploy`).
2. Merge to main (this also sends the app changes to the live Vercel site).
3. GitHub → Actions → Deploy to AWS → Run workflow, and watch the first run.
4. If the `images` job stays Queued: the repository cannot use GitHub's ARM machines; switch to emulation.

### Step 21: clean-up

```bash
# your PC
aws ec2 stop-instances --instance-ids <old id>          # stop: can come back; the disk is still billed
aws ec2 terminate-instances --instance-ids <old id>     # terminate: gone for good, with its disk
aws s3 rm s3://ktrg-backups-712723095627/<folder>/ --recursive          # cannot be undone
aws s3 rm s3://ktrg-backups-712723095627/deploy/ --recursive --exclude "aws/*"   # keeps deploy/aws/
```

A role is deleted only when empty: remove it from its instance profile, delete the profile, delete its inline
policies, detach the AWS ones, then `aws iam delete-role`.

---

## Lessons learned

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Parameter name must be a fully qualified name` | Git Bash turned `/ktrg/env` into a Windows path | `export MSYS_NO_PATHCONV=1` (or in `~/.bashrc`) |
| `Unable to load paramfile file:///tmp/…` | `aws.exe` on Windows cannot read Git Bash's `/tmp` | write the file in the project folder, or `cygpath -m` |
| `bash: --document-name: command not found` | PowerShell's `` ` `` line ending used in Git Bash | Git Bash uses `\`, PowerShell `` ` `` |
| Pasted lines after a script never ran | the script read the remaining paste as its input | paste one command at a time; scripts give `docker compose exec` `</dev/null` |
| A server command "did nothing" on the PC | it ran in Git Bash on your PC, not on the server | look at the prompt (step 6) |
| Server missing in Session Manager | role without `AmazonSSMManagedInstanceCore` | step 1 |
| `/etc/docker/daemon.json: No such file` | folder created only by the Docker package | `mkdir -p /etc/docker` first |
| `sysctl … Invalid argument` | Amazon Linux's own defaults | load only our file: `sysctl -p /etc/sysctl.d/90-swappiness.conf` |
| HTTPS "Connection refused" | nginx not restarted after Certbot | `docker compose restart nginx` |
| pgAdmin shows no tables | looking in the `postgres` database | your `POSTGRES_DB` → Schemas → public |
| A restore loaded an almost empty database | the newest dump was an empty one | name the dump: `./restore-from-s3.sh <file>` |
| `\r` at the end of every setting | the file was saved with Windows line endings | VS Code: CRLF → LF; or `sed -i 's/\r$//' file` |
| Python cannot read a file (`cp932`) | Windows reads it in the Japanese encoding | `open(…, encoding='utf-8')` |
