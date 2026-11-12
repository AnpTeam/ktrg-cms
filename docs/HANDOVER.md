# Handover

Last reviewed: 2026-11-12

Read this first if you are picking the project up. It is the map: it says where everything is, what is fragile, and what to do before you change something. It is kept short on purpose; the details live in the files it points to. **If you change how the project is run, hosted, owned or decided, change this file in the same pull request** (the checklist is at the bottom, and a test fails when the date above is more than 60 days old).

## What this is

A bilingual (Japanese and English) installable web app (PWA) with a CMS, for walkers on the Katsuragi Shugen trails: 19 routes, 31 sutra-mound places, a stamp rally checked by the server. One Next.js app (`apps/web`: visitors and `/admin`) and one Bun + Elysia API (`apps/api`), PostgreSQL through Drizzle. It was built so the same CMS and screens can serve another trail or town: see "Using this for another site".

## The documents, and where each one is

| Document | What it is for | Where |
|---|---|---|
| `README.md` | What the project is, how to start it | in this repository |
| `COMMANDS.md` | Every command for daily work | in this repository |
| `MAINTAINING.md` | Running the live site: deploys, backups, secrets, monitoring, "when something is wrong" | in this repository |
| `docs/ADMIN-GUIDE.md` | How editors use `/admin` (no developer needed) | in this repository |
| `docs/design-language.md` and the other `docs/*-design.md` | How visitor screens look and move, and why | in this repository |
| **CLAUDE.md** | The rules (security, privacy, stack, conventions) and a digest of settled decisions | **outside the repository**: `GPS/CLAUDE.md`, next to this folder |
| **decisions-log.md** | Every decision with its date and who made it | **outside the repository**: `GPS/decisions-log.md` |
| **設計書v2** (system design, appendices A to C, diagrams, `en/`) | The system design for the client, appendices generated from the code | **outside the repository**: `GPS/設計書v2/` |

The three bold rows are not in git. If the person who holds that folder leaves, they are lost. Until they are moved into the repository, ask the repository owner for a copy and keep one next to the code.

## Who owns what

Names only, never values. Real settings live in Vercel (Environment Variables) and GitHub (Secrets and variables); the list of setting names is `.env.example`.

| What | Owner today | Note |
|---|---|---|
| GitHub repository, Vercel, Supabase, Cloudflare R2, OpenRouteService key | @mzxrq | moved from AnpTeam in 2026-11 |
| Sign-in email (SMTP mailbox, `SMTP_*`, `MAIL_FROM`) | a personal mailbox | must move to a mailbox the owner controls before launch; sign-in codes stop if it is closed |
| Domain | the free Vercel address (`ktrg-cms.vercel.app`) | passkeys are tied to this address, see the risks |

## Get running in half an hour

1. `bun install` (Bun is pinned to 1.4.3 in `package.json`, CI and both Dockerfiles; it is newer than most documentation).
2. `docker compose up -d db`, copy `.env.example` to `.env` and fill the local values.
3. `bun run dev:api` and `bun run dev:web`. With no data the site shows sample content in development only.
4. `bun run check` is what CI runs (type check, tests); `bun run lint` and `bun run --cwd apps/web build` complete it.

## How it hangs together

- `apps/api/src/<feature>/`: one folder per feature (auth, content, stamps, rallies, places, posts, uploads, visits, audit ...), each with its routes, service, store and tests. `services.ts` wires them; `app.ts` is the Elysia app. Every endpoint checks the role (one permission table in `auth/`).
- `apps/api/src/db/schema/` and `apps/api/drizzle/`: the tables and the migrations. Never edit the database by hand; a change to the schema needs a migration, and CI fails without one.
- `apps/web/src/app/(public)` and `(admin)`: the screens. `lib/` holds the logic that tests cover; `components/` the shared pieces; `locales/` the Japanese and English catalogs (CI checks them).
- Migrations run on production by themselves when a change is merged to `main`; Vercel deploys by itself.

## What keeps it reliable

CI (`.github/workflows/ci.yml`) must be green to merge: translation catalogs, migration drift, a real database migration, all tests, type check, lint and a production build. Dependabot opens weekly updates. UptimeRobot watches `/api/v1/health` and the database (setup in `MAINTAINING.md`). Logs never hold emails, coordinates or codes.

## Known risks and limits (reviewed 2026-11-12)

Fix the top ones before launch. Known limits are also marked `shortcut:` in the code (`git grep "shortcut:"` lists every one, with when to upgrade it).

| # | Risk | Why it matters | What to do |
|---|---|---|---|
| 1 | `CLAUDE.md`, `decisions-log.md` and 設計書v2 are outside git | one lost folder loses the rules and the reasons | move them into the repository (or a second private repository) |
| 2 | The account purge job is disabled and `APP_URL` / `CRON_SECRET` are not set | the privacy text promises deletion after 3 days; nothing deletes yet | set the variable and the secret, enable "Purge deleted accounts" before launch |
| 3 | The keep-warm job does nothing without `APP_URL` | slow first visit after idle | set `APP_URL` |
| 4 | Passkeys are tied to the site address (`RP_ID`) | changing the address later makes every passkey useless | decide the final domain before launch and keep it |
| 5 | The sign-in email is a personal mailbox | codes stop if it closes | move to a shared sender or a transactional provider |
| 6 | Supabase free plan: no backups, and the project pauses after a week unused | data loss or downtime | the dump workflow exists; upgrade the plan at launch and test a restore |
| 7 | No error tracking; only Vercel logs and the uptime monitor | a failure can go unseen | add one tool after a yes (see `MAINTAINING.md`) |
| 8 | No browser tests; layout bugs (a ridge covering text, a hidden button) were found by eye on a phone | regressions on the screens that matter most | a few Playwright smoke tests (a new dependency: ask first) |
| 9 | Dependency advisories: zod below 4.6.6 (high) and minimatch (moderate), both through build tools | memory exhaustion on crafted input at build time, not in the running site | `bun audit fix`, run the checks, merge |
| 10 | The toolchain is new: Bun 1.4.3, TypeScript 7 native with a TypeScript 6 alias, Next 16 | documentation and answers online lag; two copies of a package break the types | keep the pins together (see `CLAUDE.md`, Commands) and read the error before upgrading |
| 11 | Content permission from temples and landowners is not yet obtained | publishing without it | places stay drafts until "permission confirmed" is ticked |
| 12 | Map tiles come from the Geospatial Information Authority of Japan (GSI) and videos from YouTube | their terms or availability can change | credit is shown; reconfirm the tile terms before launch |

## Using this for another site

Generic: the CMS (routes, waypoints, places, notices, blog, pages, roles, audit log), sign-in (email code, passkeys), the stamp and rally engine, the offline pack, furigana, the design system. Specific to Katsuragi: the seed data (`apps/api/src/db/seed-data.ts`), the facts in `apps/web/src/lib/rally.ts` (19, 31, 112 km), the story text (`apps/web/src/lib/story-text.ts`), the logo, the colours in `apps/web/src/app/globals.css`, the council's photos. A new site should start from a fresh database and replace those, not edit around them. Not yet done: one deployment serving several sites (multi-tenant); decide that before promising it.

## When you change something, also change

- A decision, a rule or a scope: `decisions-log.md` and the digest in `CLAUDE.md`.
- Who owns an account, where something is hosted, a new setting: the tables above and `.env.example`.
- A new scheduled job or monitor: `MAINTAINING.md`.
- A new known limit: write a `shortcut:` comment in the code and, if it can hurt, add a row to the risks table.
- Every review (at least every 60 days, or at each release): read the risks, update what is done, and set "Last reviewed" at the top to today.
