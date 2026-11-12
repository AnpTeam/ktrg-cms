# Maintaining the site

How to do the routine jobs. Nothing here needs a developer unless it says so. Commands run from the repo root in a terminal.

## Where things live

| What                       | Where                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Website and API            | Vercel (the web app and the API are deployed from `main`)                                  |
| Database                   | Supabase (Postgres). Free plan: no automatic backups, see "Backups"                        |
| Photos and uploaded videos | Cloudflare R2 (needs the five `R2_*` settings)                                             |
| Sign-in emails             | SMTP (`SMTP_*` and `MAIL_FROM`)                                                            |
| Scheduled jobs             | GitHub Actions: purge deleted accounts (hourly), keep the site warm, migrate, dump content |
| Admin screens              | `/admin` on the site (editors and admins)                                                  |

Settings the API reads are listed in `.env.example`. Real values live in Vercel (Settings, Environment Variables) and, for the jobs, in GitHub (Settings, Secrets and variables). Never commit or paste a real value.

## Add or change content (no developer needed)

All of this is in `/admin`. See `docs/ADMIN-GUIDE.md` for the screens.

- **Replace a route's video:** Routes, open the route, the photos and video section. Paste a YouTube or Vimeo link, or upload an MP4/WebM. An empty link hides the video. The links it had before are listed under the field ("Earlier video links"); "Put this link back" fills the field again, and you save as usual.
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

## Region counts

The "Where visits come from" screen reads the place from the headers Vercel adds to each request. The API only believes them when `TRUST_PROXY=true`, so set that in Vercel (Environment Variables) for production; without it every visit is counted as "Unknown". On a laptop there are no such headers, so the screen shows only "Unknown" there. The counts hold no IP address (table `visit_counts`: day, country, region, city, page, views).

## Rotating secrets

| Secret            | Effect of changing it                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `OTP_HMAC_SECRET` | Sign-in codes already sent stop working (people ask for a new one). Safe.                                         |
| `CRON_SECRET`     | Change it in Vercel and in the GitHub secret together, or the hourly purge job is refused.                        |
| `SMTP_PASS`       | Change in Vercel; test with `cd apps/api && bun run mail:test you@example.com`.                                   |
| `R2_*`            | Change all five together; until then uploads are off.                                                             |
| `ORS_API_KEY`     | Only the "snap to trails" button and navigation need it.                                                          |
| Database password | Change in Supabase, then in Vercel `DATABASE_URL` and the GitHub secret `PRODUCTION_DATABASE_URL`, then redeploy. |

After changing a value in Vercel, redeploy (the old value stays until the next deploy).

## After moving or renaming the repository

Vercel keeps deploying from the old GitHub path and silently stops (it happened on 2026-11-11: merges #441 to #449 were not live until it was fixed). Afterwards, in Vercel open Settings, Git and check the repository, then confirm the next merge to `main` shows a "Vercel" status on its commit. Also re-check the Vercel GitHub App is installed on the new owner and that the commit author is a member of the Vercel team.

## Scheduled jobs that need setup

Two repository settings are not set yet, so these jobs do nothing: the **variable** `APP_URL` (the site's address, no trailing slash) is used by "Keep the site warm" and by the purge job, and the **secret** `CRON_SECRET` (the same value as the API's) only by the purge job. "Purge deleted accounts" is disabled on purpose until launch: set both, then enable it in the Actions tab.

## Monitoring (UptimeRobot)

Set up once, in the UptimeRobot account (the free plan checks every 5 minutes and emails you when a check fails). Use the live site's address in place of `https://SITE`.

| Monitor  | Type    | What it checks                | Settings                                                                                         |
| -------- | ------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Site     | HTTP(s) | The home page answers         | URL `https://SITE/`                                                                              |
| API      | HTTP(s) | The API is up                 | URL `https://SITE/api/v1/health`                                                                 |
| Database | Keyword | The API can read the database | URL `https://SITE/api/v1/routes`, keyword `"ok":true`, alert when the keyword does **not** exist |

Add the people who should be told as alert contacts (email). When the Database monitor fails but API is fine, the database is unreachable or paused: look at the Supabase project first. The keep-warm workflow also visits the site, so a failing monitor and a slow first visit are different things. There is no error tracking tool yet; the Vercel function logs are the record of errors.

## When something is wrong

- **Sign-in codes do not arrive:** check `SMTP_*`, run the `mail:test` command above, and look at the Vercel function logs. Logs show the error name only, never the address.
- **Site shows no routes:** the API cannot reach the database. Check `/api/v1/health` and the Supabase project (a free project pauses after a week of no use).
- **Photos will not upload:** the log says `photo uploads are OFF` and which `R2_*` is missing.
- **A visitor wants their data deleted:** it happens by itself three days after they ask in their profile (the hourly job). Do not delete rows by hand.
- **A suspicious stamp:** Stamps screen in the admin, then revoke. It also takes back any course or rally finish that stamp earned.

## Who to ask

GitHub, Vercel, Supabase and Cloudflare R2 accounts, and the OpenRouteService key: @mzxrq (the repository owner).
Domain: the free Vercel address, nothing else to manage until launch.
Sign-in email (the SMTP mailbox behind `SMTP_USER` and `MAIL_FROM`): still Anupap (mailto:anupap@ndr.co.jp) @AnpTeam. Move it to a mailbox the owner controls before launch.
After any repository transfer or rename, re-point the Vercel Git connection (Project, Settings, Git) at the new repository and check that the newest commit on `main` has a `Vercel` status; a transfer once stopped deploys without any error.
