# Maintaining the site

How to do the routine jobs. Nothing here needs a developer unless it says so. Commands run from the repo root in a terminal.

## Where things live

| What | Where |
|---|---|
| Website and API | Vercel (the web app and the API are deployed from `main`) |
| Database | Supabase (Postgres). Free plan: no automatic backups, see "Backups" |
| Photos and uploaded videos | Cloudflare R2 (needs the five `R2_*` settings) |
| Sign-in emails | SMTP (`SMTP_*` and `MAIL_FROM`) |
| Scheduled jobs | GitHub Actions: purge deleted accounts (hourly), keep the site warm, migrate, dump content |
| Admin screens | `/admin` on the site (editors and admins) |

Settings the API reads are listed in `.env.example`. Real values live in Vercel (Settings, Environment Variables) and, for the jobs, in GitHub (Settings, Secrets and variables). Never commit or paste a real value.

## Add or change content (no developer needed)

All of this is in `/admin`. See `docs/ADMIN-GUIDE.md` for the screens.

- **Replace a route's video:** Routes, open the route, the photos and video section. Paste a YouTube or Vimeo link, or upload an MP4/WebM. An empty link hides the video.
- **Add a route:** Routes, new route. It shows as 準備中 until it has published waypoints.
- **Publish a waypoint or a place:** its position must be ticked as checked against a named source, and (for places) the listing permission ticked. The database refuses to publish otherwise.
- **A closure or hazard:** Notices. Enter the source link, the date you checked it, and an end date. Old notices disappear on their end date.

## Deploying a change

1. Open a pull request. CI runs type check, lint, tests and a build.
2. Merge it into `main`. Vercel deploys by itself (a minute or two).
3. If the change adds a migration, GitHub runs "Migrate production database" on the same merge. Check it went green in the Actions tab. If it failed, the new pages answer 500 where they read the new columns: fix the cause and run the job again by hand, or roll the deploy back in Vercel.

A change that removes or renames a column is done in two merges: first add the new column and copy the data, then drop the old one in a later merge.

## Database

```bash
bun run ktrg db status               # which migrations are applied / waiting (uses DATABASE_URL)
bun run --cwd apps/api db:generate   # new migration after a schema change
bun run --cwd apps/api db:migrate    # apply migrations (LOCAL database only)
```

Never run migrations from a laptop against Supabase: use the "Migrate production database" workflow. Some networks block the Postgres port.

### Backups

The Supabase free plan has no backups. To keep a copy of the content: Actions, "Dump content from production", Run workflow, type `dump`, then download `content-dump`. It holds the content but not accounts, stamps or other personal data, and it is deleted after one day.

To load it into a local database:

```bash
docker compose up -d db
cmd /c "docker compose exec -T db pg_restore --clean --if-exists --no-owner -U ktrg -d ktrg < content.dump"
```

This overwrites the local content. To keep accounts and stamps too, upgrade to the Supabase Pro plan (7 days of backups) or take a full `pg_dump` from a network that allows port 5432. A backup that has never been restored is not a backup: restore it once into a local database and look at the row counts.

## Rotating secrets

| Secret | Effect of changing it |
|---|---|
| `OTP_HMAC_SECRET` | Sign-in codes already sent stop working (people ask for a new one). Safe. |
| `CRON_SECRET` | Change it in Vercel and in the GitHub secret together, or the hourly purge job is refused. |
| `SMTP_PASS` | Change in Vercel; test with `cd apps/api && bun run mail:test you@example.com`. |
| `R2_*` | Change all five together; until then uploads are off. |
| `ORS_API_KEY` | Only the "snap to trails" button and navigation need it. |
| Database password | Change in Supabase, then in Vercel `DATABASE_URL` and the GitHub secret `PRODUCTION_DATABASE_URL`, then redeploy. |

After changing a value in Vercel, redeploy (the old value stays until the next deploy).

## When something is wrong

- **Sign-in codes do not arrive:** check `SMTP_*`, run the `mail:test` command above, and look at the Vercel function logs. Logs show the error name only, never the address.
- **Site shows no routes:** the API cannot reach the database. Check `/api/v1/health` and the Supabase project (a free project pauses after a week of no use).
- **Photos will not upload:** the log says `photo uploads are OFF` and which `R2_*` is missing.
- **A visitor wants their data deleted:** it happens by itself three days after they ask in their profile (the hourly job). Do not delete rows by hand.
- **A suspicious stamp:** Stamps screen in the admin, then revoke. It also takes back any course or rally finish that stamp earned.

## Who to ask

Fill in before launch: the person who owns the Vercel and Supabase accounts, the person who owns the Cloudflare account, and the person to call for the domain and email.
