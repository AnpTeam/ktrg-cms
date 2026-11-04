# Phase B plan: stamping and reading without a signal

Status: **decided 2026-11-04** (the user took my lean on all five questions below); **B1 (API) and B2 (queue module) built**, B3 to B6 not started. Written 2026-11-04. CLAUDE.md says "Build A, then B": Phase A (online app, auth, admin, map, GPS stamp) is working, so this is the next phase. Plan only: no app code until the user says go.

## What the trail needs

Routes are 2 to 10 km on foot in mountains with patchy signal, phones sit in a pocket. Two things must keep working with no signal:

1. **Read**: the map around the course, the route page, the places and their last known status.
2. **Stamp**: press 「ここでスタンプを押す」 at a place; the stamp counts when the phone is back online.

Not in scope (unchanged from CLAUDE.md): background tracking, push, Background Sync, QR, a native app.

## What exists today (so we build on it, not beside it)

| Piece | State |
| --- | --- |
| `public/sw.js` | Hand-written worker: caches `/_next/static/`, saved GSI tiles, saved route pages; GET only; **not registered anywhere in production** (`OfflineSave` is commented out in the route page). |
| `OfflineSave.tsx` + `lib/offline-tiles.ts` | Saves one route page and the tiles of its area, 8 at a time. Built, hidden. |
| Stamp request | `POST /api/v1/stamps` (account) or `/guest/stamps` (guest): `{spotId, lat, lng, accuracyM}`. Server checks distance, accuracy, closed. **No idempotency key, no client time.** Position is never stored. |
| `serwist`, `idb` | Approved in CLAUDE.md for Phase B, **not installed**. |
| Manifest, icons, maskable icon | Done (`app/manifest.ts`). |

## Decisions (all five: the user said "go with your leans", 2026-11-04)

1. **Worker: keep `sw.js` or move to `serwist`?** My recommendation: **serwist**. The hand-written worker does not precache the app shell, does not version its caches, and has no update flow; serwist gives precaching, cache versioning and a "new version, tap to refresh" hook, which CLAUDE.md requires ("updates must not strand users on an old version"). Cost: one dependency (already approved) and a build step; Bun compatibility must be checked first (the rule in "Working defaults" 6).
2. **Offline stamp = GPS only, checked at sync?** Yes by the rules: GPS only, no QR. The phone reads one position at the press, queues `{spotId, lat, lng, accuracyM, scannedAt}`, and the **server decides at upload**. Consequence: a person can be told "rejected" later (too far, closed since) while no longer at the place. We must say so in the UI before they rely on it. OK?
3. **How old may a queued stamp be?** CLAUDE.md proposes 48 h. Stamps older than that are rejected as stale. Keep 48 h?
4. **Guests offline?** A guest's stamps live in a signed cookie, written by the server at upload. Offline, the guest has nothing to show. Proposal: queue works for guests too; the entry is sent to `/guest/stamps` at sync, and "waiting to upload" is shown in the app until then. Fine?
5. **Pack size and scope.** 19 courses; a corridor of about 4 km up to zoom 16 is roughly 60 MB for all 112 km (CLAUDE.md estimate, unverified). Proposal: per-course packs, the visitor chooses, plus one "everything" pack, with a size shown before download. Check GSI's terms about caching their tiles before shipping (already a note in CLAUDE.md).

## Design

### 1. Offline pack (read)

- One pack per course: route page HTML/RSC payload, route and place JSON (language chosen), photos at display size, the GSI tiles of the course corridor (zoom 8 to 16, `offline-tiles.ts` already computes the list), last known place status with its time.
- Stored in Cache Storage (`ktrg-pack-<routeId>-v<N>`), listed in IndexedDB (`packs` store: route id, size, saved at, content version) so the screen can show "saved 3 days ago, 12 MB, update".
- App shell (scripts, styles, fonts, icons, the `/offline` fallback page) is precached by the worker, versioned with the build.
- Navigation requests: network first with a short timeout (3 s), then the pack, then `/offline`. Never serve a stale page when the network answers.
- Status ages: places show 「◯時間前の情報」 when read from the pack (CLAUDE.md: "status as of <time>").
- `navigator.storage.persist()` requested after the first pack; `estimate()` shown. Never relied on.

### 2. Stamp queue (write)

- IndexedDB store `stampQueue` via `idb`: `{ id (uuid, the idempotency key), userKey (user id or "guest"), spotId, lat, lng, accuracyM, scannedAt, tries, lastError }`. Coordinates live here only until the server confirms, then the row is deleted (CLAUDE.md privacy rule).
- On "Stamp here" with no network (or a network error): write the row, show 「あとで送ります（1件待ち）」, and the **stamp seal in a "waiting" state** (a third look: dotted ring with a small clock, distinct by shape).
- Upload triggers: app reopened, tab focus, `online` event, and a manual 「いま送る」. **No Background Sync** (not on iOS Safari). A Web Lock (`navigator.locks`) stops two tabs uploading the same row.
- Entries belong to a user key and survive session expiry; they upload after the next sign-in. Logout warns "N stamps are waiting" and offers to stay signed in.
- Retry rules: network failure keeps the row; a definite server answer (accepted, already stamped, too far, closed, rejected) removes it and shows the result once.

### 3. API changes (small, backward compatible)

- `POST /stamps` and `/guest/stamps` accept an optional `scannedAt` (ISO). **B1 dropped `clientId`:** the unique `(user, spot)` index already makes a repeat harmless and the answer to a repeat is `alreadyStamped: true`, which the queue treats as done, so a second key would be dead weight. The queue row keeps its own id for the local Web Lock only.
  - `scannedAt` is **sanity-checked, not trusted**: not in the future (±5 min), not older than 48 h, else `stale_scan` / `bad_time`. It is stored on the stamp row (`scanned_at`, new nullable column, migration) for the admin's flagged list; award time stays server time.
  - Plausibility: queued stamps are flagged for review when travel between two consecutive scans is impossible (existing rule, evaluated with `scannedAt` order). Flag, never block.
- A closed spot: accepted if `scannedAt` is before `statusUpdatedAt` of the closure (CLAUDE.md "offline stamp scanned before a closure time is accepted"). Needs the status change history; today only the latest `statusUpdatedAt` exists. Simplest rule that matches the text: reject if the spot is closed now **and** `scannedAt` is after `statusUpdatedAt`; accept otherwise.
- New batch endpoint `POST /stamps/batch` (max 20 items) is **not** planned: single posts in a loop keep the existing rate limits and error shapes. Revisit only if uploads feel slow.
- Rate limit: the stamp endpoint's limit must not punish a legitimate backlog of, say, 15 queued stamps arriving in a burst. Needs a measured look at the current limit before changing anything.

### 4. UI

- Home/rally/spot: a bar 「N件のスタンプが送信待ちです」 with 「いま送る」, visible only when the queue is not empty.
- Offline indicator: small 「オフライン」 chip in the header while `navigator.onLine` is false (a hint only; the real test is a failed request).
- Course page: 「オフラインで使う」 returns, with size and "saved N days ago".
- The stamp-progress popup (just built) shows for a queued stamp too, worded 「送信待ち」, and the ring advances provisionally; when the server rejects one, the ring goes back and a message says why.
- Every string in ja and en; all states (waiting, uploading, accepted, rejected, stale) designed before building.

### 5. Security and threat model

- The queue holds coordinates on the device only; deleted on confirmation. No coordinates in logs (existing rule).
- The server still decides everything; a tampered queue is the same as a tampered request today (distance, accuracy, closed, rate limit, plausibility flags).
- `scannedAt` can be faked; mitigation is the 48 h window, the future check, the flagged list. No prizes, so the incentive is low (CLAUDE.md).
- No tokens in IndexedDB or localStorage: the queue row has no credential; the upload uses the session cookie.
- Worker scope `/`; the worker never caches `/api/*` responses with a session cookie, never caches POSTs, never caches `Set-Cookie` responses.
- CSP already allows `worker-src blob:`; add the worker's own origin (self) check when serwist is added.

## Slices (each a small PR with tests)

| # | Slice | Verified by |
| --- | --- | --- |
| B1 (built, PR open) | API: `clientId`, `scannedAt` rules, `scanned_at` column + migration, closure rule | API tests (fixed clock), user-B-cannot-touch tests, 401 sweep body |
| B2 (built, PR open) | Queue module (`lib/stamp-queue.ts`): IndexedDB store, add/list/remove, Web Lock upload loop, retry rules, pure functions unit-tested with a fake `idb` | `bun test` |
| B3 | Wire the stamp buttons (StampHere, RallyNearbyStamp, navigation) to the queue; waiting seal state; "N waiting" bar; logout warning | component tests where possible; **real phone** |
| B4 | Worker: serwist install (after the Bun check), app shell precache, `/offline` page, update prompt | build output inspected; **real phone** |
| B5 | Offline pack per course: save/update/delete UI, size and age, status age labels, storage persistence request | unit tests for tile list and size math; **real phone** |
| B6 | Admin: show `scanned_at` and the "uploaded late" flag in the flagged stamps list | admin tests |

Order: B1, B2, B3 first (stamping offline), then B4, B5 (reading offline). Slice B3 can ship without B4/B5: the queue works even if the page itself loads (it was open when the signal dropped).

## What cannot be verified without a phone

Everything about install, the worker lifecycle, iOS storage eviction (about 7 days of non-use unless installed), airplane-mode behaviour, GPS under trees, and passkeys inside the installed app. **Test plan on real devices:** iPhone (installed, after several idle days) and Android Chrome: (1) save a course pack on wifi, (2) airplane mode, open the course, map and a place, (3) stamp at a place, see "waiting", (4) restore signal, see it upload once, (5) kill the app with a queued stamp, reopen, (6) two tabs (Android) upload without a duplicate, (7) sign out with a queued stamp, (8) wait 7 days idle on iPhone and check the pack and queue.

## Risks

- **iOS may delete the pack or the queue** after about 7 days unused (not installed). Mitigation: install prompt, always show "N waiting", upload as soon as there is signal, warn before logout.
- **GSI tile terms** for keeping a copy: check before launch.
- **Pack size** is an estimate; measure real tile sizes in B5 before promising a number to visitors.
- **Rejected after leaving the place**: a visitor stamped at a place that was just closed, or whose accuracy was flagged poor, learns it later. The wording must make this clear up front.
- **Serwist on Next 16 + Bun**: not yet checked. If it fails, fall back to extending `sw.js` (precache list generated at build) and drop the serwist dependency from the plan.

## Questions that are not mine to decide

The five under "Decisions I need from you", plus: should the stamp-progress popup claim a stamp for a queued entry before the server accepts it, or only after? (My lean: show it provisionally, marked 送信待ち, as in the UI section.)
