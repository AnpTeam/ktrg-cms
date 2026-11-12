# Katsuragi Shugen (葛城修験)

**A Journey of Renewed Discovery Through Contemplation of the “Prayer”**
(「祈り」を見つめる再発見の旅)

A bilingual (Japanese / English) installable web app (PWA) with a built-in CMS for pilgrims and tourists walking the Katsuragi Shugen trails, about 112 km across Osaka, Wakayama and Nara, from Tomogashima to the Osaka–Nara border ridge.

Walkers follow a map of 19 trail routes, tap **Stamp here** at each of the 31 sutra mound places (経塚), and keep their progress on a personal stamp card. The server checks that the phone is really near the place. Admins manage routes, places, videos, status and notices from the same app.

## Features

- Trail map with 19 routes and 31 mound places, route guides with embedded videos, and navigation while walking
- GPS stamp check-in with server-side distance and accuracy checks; coordinates are never stored
- Stamp card, a rally for each route and one rally across all 31 mound places (digital only, no physical prizes)
- Live place status (`open` / `caution` / `closed`) and dated trail notices
- Courses that cross cities, even prefectures, with the cities listed in walking order
- Passwordless sign-in with an email code and passkeys
- Japanese and English everywhere, designed for older users (large text, high contrast, dark mode)
- Blog, places directory (shops, rest areas, toilets) and custom pages, written in the admin
- Admin CMS for routes, waypoints, rallies, places, posts, comments, roles, flagged stamps and the audit log (roles: participant, editor, admin)
- No background tracking and no real-time location sharing

## Tech stack

| Area | Technology |
|---|---|
| Web app | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Map | MapLibre GL JS, GSI map tiles |
| API | Bun, Elysia, TypeBox |
| Database | PostgreSQL, Drizzle ORM |
| Auth | Email OTP, passkeys (SimpleWebAuthn), cookie sessions |
| Client data | Eden Treaty (typed API client), small `useSyncExternalStore` stores |
| i18n | Lingui (`.po` catalogs, `/ja` and `/en` routes) |
| Email | nodemailer (Gmail for dev, transactional provider for launch) |
| Video | YouTube embeds and uploaded MP4 files |
| Photos and uploads | Cloudflare R2 (S3-compatible) |
| Hosting | Vercel (web and API), Supabase (PostgreSQL), GitHub Actions (migrations and hourly jobs) |
| Local dev | Docker Compose (local Postgres) |

## Project structure

```
apps/
  api/    Bun + Elysia API
  web/    Next.js web app (public, staff and admin route groups)
docs/     Design language and longer project notes
```

## Getting started

Requirements: Bun 1.4.3, Node, Git and PostgreSQL (Docker recommended).

```
bun install
docker compose up -d db
bun run dev:api
bun run dev:web
```

Geolocation and passkeys need HTTPS, so phone testing uses an HTTPS tunnel. Every command (tests, type-check, lint, migrations, translations) is in `COMMANDS.md`.

## More documents

| File | What is in it |
|---|---|
| `COMMANDS.md` | Commands for daily work |
| `MAINTAINING.md` | Running the live site: deploys, backups, secrets, monitoring, troubleshooting |
| `CLAUDE.md` | Project rules, security rules and settled decisions |
| `docs/design-language.md` | How visitor-side screens should look and move |

---

This project is built with Claude Code.
