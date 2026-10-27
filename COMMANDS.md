# Command cheat sheet

Run from the repo root unless a folder is shown.

## Setup

```bash
bun install                      # install all workspaces
cp .env.example .env             # then fill in the values
docker compose up -d db          # local PostgreSQL 18 (needs Docker)
```

## Run

```bash
bun run dev:api                  # API on http://localhost:3001/api/v1
bun run dev:web                  # web on http://localhost:3000
curl http://localhost:3001/api/v1/health
```

## Check (what CI runs)

```bash
bun run typecheck                # api + web
bun run test                     # api + web
bun run lint                     # web
bun run --cwd apps/web build     # Next.js build
```

Single package:

```bash
cd apps/api && bun test                      # all api tests
cd apps/api && bun test src/auth             # one folder
cd apps/api && bun test -t "cooldown"        # tests matching a name
```

## Mail (WBS 2.1.1)

```bash
cd apps/api && bun run mail:test you@example.com
```

Leave `SMTP_HOST` empty to print the email to the console. For Gmail use
`smtp.gmail.com`, port `587`, your address and an App Password.

## OTP login (WBS 2.1.3)

```bash
curl -X POST http://localhost:3001/api/v1/auth/otp/request \
  -H "content-type: application/json" \
  -d '{"email":"you@example.com"}'
```

Needs `OTP_HMAC_SECRET` (32+ characters) in `.env` in production, and a
database with the `otp_codes` table.

## Database (Drizzle)

```bash
cd apps/api
bunx drizzle-kit generate        # create a migration from src/db/schema
bunx drizzle-kit migrate         # apply migrations to DATABASE_URL
bunx drizzle-kit studio          # browse the data
```

Check `DATABASE_URL` first: it may point at a remote database, not local Docker.

## Translations

```bash
bun run --cwd apps/web lingui:extract    # after adding or changing a message; then fill in the English in src/locales/en.po
bun run --cwd apps/web check:catalogs    # fails when a message has no English
bun run --cwd apps/web resolve:catalogs  # in the middle of a merge or rebase that conflicts in en.po / ja.po
```

`resolve:catalogs` takes main's catalogs, extracts again so the branch's new messages are added, and puts the branch's own
English back. It marks the files resolved; then run `check:catalogs` and commit. Works for a merge and for a rebase.

A git merge driver does the same job on its own: `bun install` registers it (`bun run setup:git` if you skipped install), and after that a merge or rebase
never shows a conflict in `en.po` / `ja.po`. It keeps main's catalog and adds the branch's new messages and English; run `check:catalogs` after a merge.

## Git

```bash
git switch main && git pull --rebase origin main     # update main
git switch -c feat/<name>                            # new branch for a task
git add <files> && git commit -m "feat: ..."
git push -u origin feat/<name>                       # then open a PR
git pull --rebase origin main                        # bring your branch up to date
git stash push -u -m "WIP note"                      # park work
git stash list && git stash pop                      # list / restore
```

## GitHub CLI

```bash
gh issue list --milestone "Sprint 1"
gh issue view 23
gh pr create --title "..." --body "Closes #23"       # link PR to issue
gh pr checks                                         # CI status
```
