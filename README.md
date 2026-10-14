# Katsuragi Shugen Tour and Stamp Rally

A bilingual (Japanese / English) installable web app (PWA) with a built-in CMS for pilgrims and tourists walking the Katsuragi Shugen (葛城修験) trails across Osaka, Wakayama and Nara.

Participants follow a map of 19 trail routes, tap **Stamp here** at each of the 28 sutra mounds (経塚), and track their progress on a personal stamp card. The server checks that the phone is really near the spot. Admins manage routes, spots, videos, spot status and trail notices from the same app.

> **Status:** design phase. See the system design document for the full plan.

## Features

- Trail map with 19 routes and 28 mounds, route guides and embedded videos
- GPS stamp check-in with server-side distance and accuracy checks
- Stamp card and one permanent rally across all 28 spots
- Live spot status (`open` / `caution` / `closed`) and dated trail notices
- Passwordless login with email code and passkeys
- Japanese and English UI, designed for older users (large text, high contrast)
- Admin CMS for routes, spots, rally settings, roles, flagged stamps and audit log
- No background tracking, and GPS coordinates are not stored

## Tech stack

| Area | Technology |
|---|---|
| Web app | Next.js, React, TypeScript, Tailwind CSS |
| Map | MapLibre GL JS, GSI map tiles (tentative) |
| API | Bun, Elysia, TypeBox |
| Database | PostgreSQL 16, Drizzle ORM |
| Auth | Email OTP, passkeys (WebAuthn via SimpleWebAuthn), cookie sessions |
| Client data | Eden Treaty, TanStack Query, Zustand |
| i18n | next-intl |
| Email | nodemailer (Gmail for dev, transactional provider for launch) |
| Video | YouTube / Vimeo embeds |
| Dev and hosting | Docker Compose (local Postgres), Vercel (planned) |

## Project structure (planned)

```
apps/
  api/    Bun + Elysia API
  web/    Next.js web app (public and admin route groups)
```

## Getting started

Setup instructions will be added once the project is scaffolded. Requirements: Bun, Node, Git and PostgreSQL 16 (Docker recommended). Geolocation and passkeys need HTTPS, so phone testing uses an HTTPS tunnel.
